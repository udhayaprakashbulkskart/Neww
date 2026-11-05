import { handle, json, readJson, clientIp } from '@/lib/http';
import { otpRequestSchema } from '@/lib/validation/schemas';
import { requestOtp } from '@/lib/services/auth';

export const POST = handle(async (req: Request) => {
  const body = otpRequestSchema.parse(await readJson(req));
  const result = await requestOtp({
    mobile: body.mobile,
    purpose: body.purpose,
    fullName: body.fullName,
    userType: body.userType,
    consent: body.consent,
    ip: clientIp(req),
  });
  return json(result);
});

export const dynamic = 'force-dynamic';
