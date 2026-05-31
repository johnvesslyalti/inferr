import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { jobs, NewJob } from '../db/schema';

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

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

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
