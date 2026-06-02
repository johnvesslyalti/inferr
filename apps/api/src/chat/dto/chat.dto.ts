import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryMessageDto {
  @IsString()
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content: string;
}

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];
}

// Shared result types used by controller, services, and frontend contract
export interface ChatSource {
  title: string;
  url: string;
  source: string;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
}

// Internal shape for LangGraph state / agentic service (plain, no validation needed)
export interface GraphHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
