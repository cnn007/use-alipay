export interface AlipayConfig {
    appId: string;

    privateKey: string;

    signType: "RSA2" | "RSA";

    alipayPublicKey?: string;

    url: string;

    encryptKey: string;

    charset?: "utf-8";
}

/**
 * Alipay use post
 *
 * sign before
 *
 *
 * checkSign
 */


export interface AlipayRequest {
    appId: string;

    version: "1.0";

    method: string;

    sign: string;

    charset: "utf-8" | "gbk";

    notifyUrl?: string;

    bizContent: string;

    appAuthToken: string;
    
}

export class Alipay {

    // Sign a request
    sign() {

    }


    // api: xx
    createOrder() {

    }

    queryOrder() {

    }
}

export function useAlipay() {

}
