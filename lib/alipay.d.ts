import {PrivateKeyInput} from "crypto";
import {Buffer} from "buffer";
import {Alipay} from "./use-alipay";

export type AlipaySignType = "RSA2" | "RSA";

export interface AlipayConfig {
    appId: string;

    /**
     * @see https://opendocs.alipay.com/isv/10467/xldcyq
     */
    appAuthToken?: string;

    /**
     * App private key
     */
    appPrivateKey: string | Buffer | PrivateKeyInput;

    signType?: AlipaySignType;

    appPublicKey?: string | Buffer;
    alipayPublicKey?: string | Buffer;
    alipayRootPublicKey?: string | Buffer;

    /**
     * AES key.
     *
     * @see https://opendocs.alipay.com/common/02mse3
     */
    encryptKey?: string;
    /**
     * default: base64
     */
    encryptKeyEncoding?: string;

    /**
     * AES encrypt algorithm.
     *
     * default: AES/CBC/PKCS5Padding
     */
    encryptAlgorithm?: string;

    baseNotifyURL?: string;

    gateway?: string;
    version?: string;
    format?: string;
    charset?: string;

    requestOptionsMap?: Record<string, AlipayRequestOptions>;
}

export interface AlipayRequest {
    app_id: string;
    method: string;
    format?: string;
    charset: string;
    sign_type?: AlipaySignType;
    sign: string;
    timestamp: string;
    version: string;
    app_auth_token?: string;
    biz_content: string;
    notify_url?: string;
    return_url?: string;
    app_cert_sn?: string;
    alipay_root_cert_sn?: string;
}

type AsyncNotifyHandler = (notifyContent: any, alipay: Alipay) => Promise<any>;

export interface AlipayRequestOptions {
    encrypt?: boolean;

    notify?: boolean;

    /**
     * A callback when alipay notify
     */
    onNotify?: AsyncNotifyHandler;
}

export interface AlipayResponseBase {
    code: string;
    msg: string;

    // If sub code exists, you must be in trouble
    sub_code?: string;
    sub_msg?: string;
}

export interface AlipayResponse {
    sign: string;
    alipay_cert_sn?: string;
}
