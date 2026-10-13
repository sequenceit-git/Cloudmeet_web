import { ENV } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TLSSigAPIv2 = require('tls-sig-api-v2');

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
  public generateUserSig(userId: string, expireTime: number = ENV.TRTC_EXPIRE_TIME): { userSig: string; sdkAppId: number; expireTime: number } {
    if (!userId) {
      throw new Error('UserId is required to generate TRTC UserSig');
    }

    const userSig = this.api.genUserSig(userId, expireTime);

    return {
      userSig,
      sdkAppId: ENV.TRTC_SDK_APP_ID,
      expireTime,
    };
  }
}

export const trtcService = new TRTCService();
