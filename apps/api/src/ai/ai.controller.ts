import { Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('process')
  async process() {
    const result = await this.aiService.processUnsummarized();
    return result;
  }
}
