import {Express, Router} from "express";
import axios, {Axios, AxiosRequestConfig, AxiosResponse} from "axios";
import {AlipayRequest, AlipayRequestOptions, AlipayResponse, CreateOrderRequest, CreateOrderResponse} from "./alipay";
import * as https from "https";

import {
    createSign, createCipheriv, createDecipheriv, createPrivateKey,
    X509Certificate, KeyObject, PrivateKeyInput,
} from "crypto";
import {Buffer} from "buffer";

import {format as formatDate} from "date-fns";

// const {X509Certificate} = await import("crypto");

export const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";

// The default sign type
export const RSA2 = "RSA2";

// Legacy sign type
export const RSA = "RSA";

const UTF8 = "utf-8";

export type AlipaySignType = "RSA2" | "RSA";

type Param = [string, string | undefined];

class ByteBuffer {
    buf: Buffer;
    pos: number;

    constructor(buf: Buffer, pos: number = 0) {
        this.buf = buf;
        this.pos = pos;
    }

    write(string: string): ByteBuffer {
        const pos = this.pos;
        const bs = this.buf.write(string, this.pos);
        // UTF-8 is 1~4 byte(s)
        if (bs >= this.buf.length - pos - 4) {
            this.buf = Buffer.alloc(this.buf.length << 1, this.buf);
            this.pos = pos;
            return this.write(string);
        }
        this.pos += bs;
        return this;
    }

}

const UTF8_BUFFER_1M = Buffer.alloc(1024 * 1024, undefined, UTF8);

const DEFAULT_REQUEST_OPTS: AlipayRequestOptions = {
    encrypt: false,
    notify: false,
};

// format pem
// algorithem rsa
//

// use-encrypt

// encrypt, sign...
// decrypt
// verify
// sign

export interface Key {
    key: string | Buffer | ArrayBuffer;
    format?: "pem" | "der" | "jwk";
    type?: "pkcs1" | "pkcs8" | "sec1";
    encoding?: string;
}

export interface AlipayConfig {
    appId: string;

    /**
     * Oauth token
     *
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
}


/**
 * The alipay sdk.
 */
export class Alipay {

    axios: Axios;

    baseNotifyURL?: string;

    appId: string;

    appAuthToken?: string;

    signType: AlipaySignType;

    /**
     * AES key
     */
    encryptKey?: string;

    encryptKeyFormat?: string;

    // version is fixed
    version: string;

    // biz_content format, only accepts JSON
    format: string;

    charset: string;

    appPrivateKey: KeyObject;
    appPublicKey?: KeyObject;
    appPublicKeySN?: string;
    alipayPublicKey?: KeyObject;
    alipayRootPublicKey?: KeyObject;
    alipayRootPublicKeySN?: string;

    requestOptionsMap: Map<string, AlipayRequestOptions>;

    constructor(config: AlipayConfig) {

        const {
            appId,
            appAuthToken,
            baseNotifyURL,
            gateway = ALIPAY_GATEWAY,
            signType = RSA2,
            charset = "utf-8",
            version = "1.0",
            format = "JSON",
        } = config;


        this.appId = appId;
        this.appAuthToken = appAuthToken;
        this.baseNotifyURL = baseNotifyURL;
        this.version = version;
        this.signType = signType;
        this.charset = charset;
        this.format = format;

        this.appPrivateKey = createPrivateKey(config.appPrivateKey);

        if (config.appPublicKey) {
            this.appPublicKey = new X509Certificate(config.appPublicKey).publicKey;
        }

        if (config.alipayPublicKey) {
            this.alipayPublicKey = new X509Certificate(config.alipayPublicKey).publicKey;
        }

        if (config.alipayRootPublicKey) {
            this.alipayRootPublicKey = new X509Certificate(config.alipayRootPublicKey).publicKey;
        }


        this.axios = axios.create({
            baseURL: gateway,
            httpsAgent: new https.Agent({
                keepAlive: true,
            }),
        });

        this.axios.interceptors.request.use(this.signRequest);
        this.axios.interceptors.response.use(this.verifyResponse);

        this.requestOptionsMap = new Map<string, AlipayRequestOptions>();
    }

    signRequest(requestConfig: AxiosRequestConfig) {

        let {data} = requestConfig;

        const method = requestConfig.url || "";

        requestConfig.params = this.sign(method, data);


    }

    verifyResponse(response: AxiosResponse) {
        response.request;

    }

    encrypt(data: string): string {
        if (typeof this.encryptKey === "string") {
            const iv = Buffer.alloc(16, 0);
            const key = Buffer.from(this.encryptKey, "base64");
            return createCipheriv("aes-128-cbc", key, iv)
                .update(data)
                .toString("base64");
        } else {
            return data;
        }
    }

    decrypt(data: string): string {
        if (typeof this.encryptKey === "string") {
            const key = Buffer.from(this.encryptKey, "base64");
            const iv = Buffer.alloc(16, 0);
            return createDecipheriv("aes-128-cbc", key, iv)
                .update(data, "base64")
                .toString("utf8");
        } else {
            return data;
        }
    }

    // Sign a request
    sign(method: string, body: string | Object): AlipayRequest {

        const requestOpts = this.requestOptionsMap.get(method) || DEFAULT_REQUEST_OPTS;

        let notify_url,
            sign,
            timestamp = formatDate(new Date(), "YYYY-MM-DD HH:mm:ss"),
            biz_content;

        if (requestOpts.notify && this.baseNotifyURL) {
            notify_url = `${this.baseNotifyURL}/ack/${method}`;
        }

        const {
            appId: app_id,
            appAuthToken: app_auth_token,
            format,
            version,
            charset,
            signType: sign_type,
        } = this;


        biz_content = JSON.stringify(body);
        if (requestOpts.encrypt && this.encryptKey) {
            biz_content = this.encrypt(biz_content);
        }

        const params: Array<Param> = [
            ["app_id", app_id],
            ["method", method],
            ["format", format],
            ["charset", charset],
            ["sign_type", sign_type],
            ["timestamp", timestamp],
            ["version", version],
            ["app_auth_token", app_auth_token],
            ["biz_content", biz_content],
            ["app_cert_sn", this.appPublicKeySN],
            ["alipay_root_cert_sn", this.alipayRootPublicKeySN],
            ["return_url", notify_url],
        ];

        let buf: ByteBuffer = params.sort().reduce((b, p) => {
            if (p[1]) {
                b.write("&")
                    .write(p[0])
                    .write("=")
                    .write(p[1]);
            }
            return b;
        }, new ByteBuffer(UTF8_BUFFER_1M));

        sign = createSign(this.signType)
            .update(buf.buf.slice(1, buf.pos))
            .sign(this.appPrivateKey, "base64");

        return {
            app_id,
            method,
            format,
            charset,
            version,
            sign_type,
            sign,
            timestamp,
            app_auth_token,
            biz_content,
            notify_url,
        };
    }

    async request<Req, Resp>(method: string, bizContent: Req): Promise<Resp> {
        console.log("method", method, "biz_content", bizContent);
        return this.axios.post(method, bizContent);
    }

}

/**
 * Create alipay sdk
 */
export function useAlipay(options: AlipayConfig, expressApp?: Express): Alipay {

    const alipay = new Alipay(options);

    console.log("alipay is ready");
    if (expressApp) {

        const r = Router();

        console.log("unsafe");

        r.post("/submit/:method", async (req, resp) => {
            // body is biz content
            const bizContent = req.body;
            const {method} = req.query;
            console.log("method", method, "body", bizContent);

            if (typeof method === "string") {
                alipay.request(method, bizContent).then(r => resp.json(r)).catch(e => {
                    resp.status(500).end();
                });
            } else {
                resp.status(404).end();
            }
        });

        r.post("/ack/:method", async (req, resp) => {

            // Handle alipay notify


            resp.send("success");
        });


        expressApp.use("/alipay", r);
    }

    return alipay;

}
