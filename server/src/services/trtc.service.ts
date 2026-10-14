import { ENV } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TLSSigAPIv2 = require('tls-sig-api-v2');

/**
 * TUICallKit user IDs may contain letters, numbers, and underscores, and must
 * be at most 32 characters. A database UUID is 36 characters with hyphens.
 * Removing hyphens yields a stable 32-character id.
 */
export function toCallUserId(userId: string): string {
  const safe = userId.replace(/-/g, '').replace(/[^A-Za-z0-9_]/g, '');
  if (!safe) {
    throw new Error('UserId is required to generate TRTC UserSig');
  }
  return safe.slice(0, 32);
}

export class TRTCService {
  private api: any;

  constructor() {
    this.api = new TLSSigAPIv2.Api(ENV.TRTC_SDK_APP_ID, ENV.TRTC_SECRET_KEY);
  }

  /**
   * Generates a temporary UserSig for a given userId.
   * Client presents this UserSig to Tencent TRTC SDK to authenticate without exposing the master secret.
   * 
   * @param userId Unique user ID string (Host UUID or Guest UUID/Session ID)
   * @param expireTime Expiry duration in seconds (defaults to ENV.TRTC_EXPIRE_TIME)
   */
  public generateUserSig(userId: string, expireTime: number = ENV.TRTC_EXPIRE_TIME): { userSig: string; sdkAppId: number; userId: string; expireTime: number } {
    const callUserId = toCallUserId(userId);
    const userSig = this.api.genUserSig(callUserId, expireTime);

    return {
      userSig,
      sdkAppId: ENV.TRTC_SDK_APP_ID,
      userId: callUserId,
      expireTime,
    };
  }
}

export const trtcService = new TRTCService();
