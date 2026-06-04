import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, gte } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { jobs, NewJob } from '../db/schema';
import { AiService } from '../ai/ai.service';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
}

export interface TrendingRole {
  role: string;
  demand: number; // 1-5
  trend: string;  // e.g. "Very High", "Growing Fast"
}

export interface MarketReport {
  roles: TrendingRole[];
  generatedAt: string;
}

export interface JobReport {
  totalListings: number;
  topSkills: { skill: string; count: number }[];
  roleBreakdown: { category: string; count: number }[];
  topCompanies: { company: string; count: number }[];
  generatedAt: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private cachedMarketReport: MarketReport | null = null;
  private cacheGeneratedAt: Date | null = null;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly aiService: AiService,
  ) {}

  async getMarketReport(): Promise<MarketReport> {
    // Cache for 24 hours — we only call OpenAI once per day
    if (
      this.cachedMarketReport &&
      this.cacheGeneratedAt &&
      Date.now() - this.cacheGeneratedAt.getTime() < 24 * 60 * 60 * 1000
    ) {
      return this.cachedMarketReport;
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await this.db
      .select({ title: jobs.title, tags: jobs.tags })
      .from(jobs)
      .where(gte(jobs.createdAt, since))
      .orderBy(desc(jobs.createdAt));

    if (rows.length === 0) {
      return { roles: [], generatedAt: new Date().toISOString() };
    }

    // Build a compact summary of the raw data to send to GPT
    const titlesSample = rows
      .slice(0, 50)
      .map((r) => r.title)
      .join('\n');

    const tagFreq = new Map<string, number>();
    for (const r of rows) {
      for (const t of r.tags ?? []) {
        const k = t.trim().toLowerCase();
        if (k) tagFreq.set(k, (tagFreq.get(k) ?? 0) + 1);
      }
    }
    const topTags = [...tagFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => `${tag} (${count})`)
      .join(', ');

    const prompt = `You are a tech job market analyst. Based on this real job posting data, identify the top 8 trending tech FIELDS/DOMAINS right now.

Job titles from recent postings:
${titlesSample}

Top skills/tags appearing across all postings:
${topTags}

Return ONLY a valid JSON array — no markdown, no explanation. Format:
[
  { "role": "AI / ML", "demand": 5, "trend": "Explosive Growth" },
  { "role": "DevOps", "demand": 4, "trend": "Very High" }
]

Rules:
- "role" must be a broad tech FIELD or DOMAIN (e.g. "AI / ML", "Backend", "DevOps", "Data Engineering", "Frontend", "Security", "Mobile", "Web3", "Platform Engineering")
- NO job levels like "Senior", "Staff", "Founding", "Junior" — only the field name
- "demand" is 1-5 (5 = hottest)
- "trend" is a short signal phrase (max 3 words)
- Sort by demand descending
- Return exactly 8 fields`;

    try {
      const response = await this.aiService.chat(prompt);
      // Strip any markdown fences GPT may add despite the prompt instruction.
      // Matches opening fence with any language tag (```json, ```javascript, etc.)
      const clean = response.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(clean) as TrendingRole[];
      this.cachedMarketReport = { roles: parsed, generatedAt: new Date().toISOString() };
      this.cacheGeneratedAt = new Date();
      return this.cachedMarketReport;
    } catch (err) {
      this.logger.error('Failed to generate market report', err);
      // Rate-limit retries: arm a 1-hour penalty on every failure by always
      // updating cacheGeneratedAt. Without this, the guard below would skip
      // the update after the first failure, leaving cacheGeneratedAt frozen
      // and causing every request after the first cooldown to re-call OpenAI.
      if (!this.cachedMarketReport) {
        this.cachedMarketReport = { roles: [], generatedAt: new Date().toISOString() };
      }
      this.cacheGeneratedAt = new Date(Date.now() - 23 * 60 * 60 * 1000); // 1h effective TTL
      return { roles: [], generatedAt: new Date().toISOString() };
    }
  }

  async scrapeRemotive(): Promise<number> {
    this.logger.log('Scraping Remotive API...');

    const res = await fetch(
      'https://remotive.com/api/remote-jobs?category=software-dev',
      { headers: { 'User-Agent': 'inferr/1.0' } },
    );
    if (!res.ok) throw new Error(`Remotive API error: ${res.status}`);

    const data = (await res.json()) as { jobs: RemotiveJob[] };

    const rows: NewJob[] = data.jobs.map((job) => ({
      externalId: String(job.id),
      title: job.title,
      url: job.url,
      company: job.company_name,
      category: job.category,
      tags: job.tags ?? [],
      jobType: job.job_type,
      location: job.candidate_required_location || null,
      salary: job.salary || null,
      publishedAt: job.publication_date ? new Date(job.publication_date) : null,
    }));

    if (rows.length === 0) return 0;

    const inserted = await this.db
      .insert(jobs)
      .values(rows)
      .onConflictDoNothing({ target: jobs.externalId })
      .returning({ id: jobs.id });

    this.logger.log(
      `Saved ${inserted.length} new jobs (skipped ${rows.length - inserted.length} duplicates)`,
    );
    return inserted.length;
  }

  async getReport(): Promise<JobReport> {
    // Pull jobs from the last 30 days for the report
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await this.db
      .select({
        category: jobs.category,
        tags: jobs.tags,
        company: jobs.company,
      })
      .from(jobs)
      .where(gte(jobs.createdAt, since))
      .orderBy(desc(jobs.createdAt));

    // Aggregate tags → top skills
    const skillMap = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags ?? []) {
        const normalised = tag.trim().toLowerCase();
        if (normalised) skillMap.set(normalised, (skillMap.get(normalised) ?? 0) + 1);
      }
    }
    const topSkills = [...skillMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([skill, count]) => ({ skill, count }));

    // Aggregate by category → role breakdown
    const categoryMap = new Map<string, number>();
    for (const row of rows) {
      const cat = row.category ?? 'Other';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
    }
    const roleBreakdown = [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));

    // Top hiring companies
    const companyMap = new Map<string, number>();
    for (const row of rows) {
      const co = row.company ?? 'Unknown';
      companyMap.set(co, (companyMap.get(co) ?? 0) + 1);
    }
    const topCompanies = [...companyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    return {
      totalListings: rows.length,
      topSkills,
      roleBreakdown,
      topCompanies,
      generatedAt: new Date().toISOString(),
    };
  }
}
