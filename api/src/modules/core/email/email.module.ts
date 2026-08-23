import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { GmailApiService } from './gmail-api.service';

@Module({
  providers: [EmailService, GmailApiService],
  exports: [EmailService],
})
export class EmailModule {}
