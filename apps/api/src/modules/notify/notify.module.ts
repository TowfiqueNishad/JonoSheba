import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import {
  EmailChannelAdapter,
  InAppChannelAdapter,
  IvrStubChannelAdapter,
  MobilePushChannelAdapter,
  SmsChannelAdapter,
  WebPushChannelAdapter,
  WhatsAppStubChannelAdapter,
} from './adapters/channel.adapters';
import { InMemoryNotifyRepository } from './adapters/in-memory-notify.repository';
import { NotifyService } from './application/notify.service';
import { NotifyController } from './controllers/notify.controller';
import { NOTIFICATION_CHANNELS_PORT } from './ports/channel.port';
import { NOTIFY_REPOSITORY_PORT } from './ports/notify.repository.port';

@Module({
  imports: [IdentityModule],
  controllers: [NotifyController],
  providers: [
    NotifyService,
    InMemoryNotifyRepository,
    InAppChannelAdapter,
    WebPushChannelAdapter,
    MobilePushChannelAdapter,
    EmailChannelAdapter,
    SmsChannelAdapter,
    WhatsAppStubChannelAdapter,
    IvrStubChannelAdapter,
    { provide: NOTIFY_REPOSITORY_PORT, useExisting: InMemoryNotifyRepository },
    {
      provide: NOTIFICATION_CHANNELS_PORT,
      useFactory: (
        inApp: InAppChannelAdapter,
        webPush: WebPushChannelAdapter,
        mobilePush: MobilePushChannelAdapter,
        email: EmailChannelAdapter,
        sms: SmsChannelAdapter,
        whatsapp: WhatsAppStubChannelAdapter,
        ivr: IvrStubChannelAdapter,
      ) => [inApp, webPush, mobilePush, email, sms, whatsapp, ivr],
      inject: [
        InAppChannelAdapter,
        WebPushChannelAdapter,
        MobilePushChannelAdapter,
        EmailChannelAdapter,
        SmsChannelAdapter,
        WhatsAppStubChannelAdapter,
        IvrStubChannelAdapter,
      ],
    },
  ],
  exports: [NotifyService, NOTIFY_REPOSITORY_PORT],
})
export class NotifyModule {}
