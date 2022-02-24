import {
    createSign, createCipheriv, createDecipheriv, createPrivateKey,
    createHash,
    X509Certificate, KeyObject,
} from "crypto";
import {Buffer} from "buffer";
import * as https from "https";
import * as http from "http";

import {Router, IRouter} from "express";
import axios, {Axios, AxiosRequestConfig, AxiosResponse, AxiosProxyConfig} from "axios";
import {format as formatDate} from "date-fns";

import {AlipaySignType, AlipayConfig, AlipayRequest, AlipayRequestOptions} from "./alipay";


// -- Constants

const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";

const DEFAULT_ALIPAY_SIGN_TYPE: AlipaySignType = "RSA2";

const ALIPAY_MOUNT_POINT = "/alipay";

const UNSAFE_MOUNT_POINT = "/unsafe/alipay";

const ALIPAY_ROOT_CERT_SN = "687b59193f3f462dd5336e5abf83c5d8_02941eef3187dddf3d3b83462e1dfcf6";

const SUCCESS = "success";

const ERROR = "error";

const DEFAULT_REQUEST_OPTS: AlipayRequestOptions = {
    encrypt: false,
    notify: false,
};

// -- End constants


export function alipayCertSN(x509: X509Certificate): string {
    const issuer = x509.issuer.split("\n").reverse().join(",");
    const sn = BigInt(`0x${x509.serialNumber}`).toString(10);

    return createHash("md5")
        .update(issuer, "utf8")
        .update(sn, "utf8")
        .digest("hex");
}


// -- Types

type Param = [string, string | undefined];

interface AxiosConfig {
    requestTimeoutMs?: number,
    keepAlive?: boolean,
    proxy?: AxiosProxyConfig,
}

interface MountConfig {
    expressApp?: IRouter,
    alipayMountPoint?: string,
    unsafeMountPoint?: string;
}

class ByteBuffer {
    buf: Buffer;
    pos: number;

    constructor(buf: Buffer, pos: number = 0) {
        this.buf = buf;
        this.pos = pos;
    }

    write(string: string): ByteBuffer {
        const pos = this.pos;
        const bytes = this.buf.write(string, this.pos);
        // UTF-8 is 1~4 byte(s)
        if (bytes >= this.buf.length - pos - 4) {
            this.buf = Buffer.alloc(this.buf.length << 1, this.buf);
            this.pos = pos;
            return this.write(string);
        }
        this.pos += bytes;
        return this;
    }

}

// -- End types


/**
 * The Alipay SDK.
 */
export class Alipay {

    private axios: Axios;

    private baseNotifyURL?: string;

    private readonly appId: string;

    private appAuthToken?: string;

    private signType: AlipaySignType;

    /**
     * AES key
     */
    private encryptKey?: string;

    // version is fixed
    private version: string;

    // biz_content format, only accepts JSON
    private format: string;

    private charset: string;

    private appPrivateKey: KeyObject;
    private appPublicKey?: KeyObject;
    private appPublicKeySN?: string;
    private alipayPublicKey?: KeyObject;
    private alipayPublicKeySN?: string;
    private alipayRootPublicKey?: KeyObject;
    private alipayRootPublicKeySN?: string;

    private requestOptionsMap: Map<string, AlipayRequestOptions>;

    private tmpBuffer = Buffer.alloc(1024 * 1024);

    constructor(config: AlipayConfig, options: AxiosConfig) {

        const {
            appId,
            appAuthToken,
            baseNotifyURL,
            gateway = ALIPAY_GATEWAY,
            signType = DEFAULT_ALIPAY_SIGN_TYPE,
            charset = "utf-8",
            version = "1.0",
            format = "JSON",
            encryptKey,
        } = config;


        this.appId = appId;
        this.appAuthToken = appAuthToken;
        this.baseNotifyURL = baseNotifyURL;
        this.version = version;
        this.signType = signType;
        this.charset = charset;
        this.format = format;

        this.encryptKey = encryptKey;
        this.appPrivateKey = createPrivateKey(config.appPrivateKey);

        let x509: X509Certificate;
        if (config.appPublicKey) {
            x509 = new X509Certificate(config.appPublicKey);
            this.appPublicKey = x509.publicKey;
            this.appPublicKeySN = alipayCertSN(x509);
            this.alipayRootPublicKeySN = ALIPAY_ROOT_CERT_SN;

        }
        if (config.alipayPublicKey) {
            x509 = new X509Certificate(config.alipayPublicKey);
            this.alipayPublicKey = x509.publicKey;
            this.alipayPublicKeySN = alipayCertSN(x509);

        }
        if (config.alipayRootPublicKey) {
            x509 = new X509Certificate(config.alipayRootPublicKey);
            this.alipayRootPublicKey = x509.publicKey;
        }

        const {requestTimeoutMs, keepAlive = true, proxy} = options;
        // TODO How to get version from package.json?
        // const pkg = require("../../package.json");

        this.axios = axios.create({
            baseURL: gateway,
            timeout: requestTimeoutMs,
            proxy,
            headers: {
                "User-Agent": "use-alipay",
            },
            httpsAgent: new https.Agent({
                keepAlive,
            }),
            httpAgent: new http.Agent({
                keepAlive,
            }),
        });

        this.axios.interceptors.request.use(async (config) => {
            return this.signRequest(config);
        });
        this.axios.interceptors.response.use((response) => {
            return this.verifyResponse(response);
        });

        this.requestOptionsMap = new Map<string, AlipayRequestOptions>();
    }

    getRequestOptions(method: string): AlipayRequestOptions {
        return this.requestOptionsMap.get(method) || DEFAULT_REQUEST_OPTS;
    }

    private async signRequest(config: AxiosRequestConfig) {

        let {data} = config;

        const method = config.url || "";

        config.params = this.sign(method, data);
        config.url = undefined;
        return config;
    }

    private async verifyResponse(response: AxiosResponse) {
        // TODO Verify/decrypt response

        // extract the xxx_response, and set it as response data
        const data = response.data;
        if (typeof data === "object") {
            for (let k of Object.keys(data)) {
                if (k.endsWith("_response")) {
                    response.data = data[k];
                    break;
                }
            }
        }


        return response;
    }

    encrypt(data: string | Buffer): string {
        if (typeof this.encryptKey === "string") {
            const iv = Buffer.alloc(16, 0);
            const key = Buffer.from(this.encryptKey, "base64");
            const cipher = createCipheriv("aes-128-cbc", key, iv);
            cipher.update(data);
            return cipher.final("base64");
        } else {
            return ERROR;
        }
    }

    decrypt(data: string): string {
        if (typeof this.encryptKey === "string") {
            const key = Buffer.from(this.encryptKey, "base64");
            const iv = Buffer.alloc(16, 0);
            const decipher = createDecipheriv("aes-128-cbc", key, iv);
            return decipher.final("utf8");
        } else {
            return ERROR;
        }
    }

    // Sign a request
    sign(method: string, body: string | Object): AlipayRequest {

        const requestOpts = this.getRequestOptions(method);

        let notify_url,
            sign,
            timestamp = formatDate(new Date(), "yyyy-MM-dd HH:mm:ss"),
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
            appPublicKeySN: app_cert_sn,
            alipayRootPublicKeySN: alipay_root_cert_sn,
        } = this;


        biz_content = typeof biz_content === "string" ? biz_content : JSON.stringify(body);
        if (requestOpts.encrypt) {
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
            ["notify_url", notify_url],
        ];

        let buf: ByteBuffer = params.sort().reduce((b, p) => {
            if (p[1]) {
                b.write("&")
                    .write(p[0])
                    .write("=")
                    .write(p[1]);
            }
            return b;
        }, new ByteBuffer(this.tmpBuffer));

        sign = createSign("RSA-SHA256")
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
            alipay_root_cert_sn,
            app_cert_sn,
        };
    }

    async request<Req, Resp>(method: string, bizContent: Req): Promise<Resp> {
        return this.axios.post(method, bizContent).then(response => response.data);
    }

}

/**
 * Create alipay sdk
 */
export function useAlipay(config: AlipayConfig,
                          options: AxiosConfig & MountConfig = {}): Alipay {

    const alipay = new Alipay(config, options);

    const {
        expressApp,
        alipayMountPoint = ALIPAY_MOUNT_POINT,
        unsafeMountPoint = UNSAFE_MOUNT_POINT,
    } = options;
    if (expressApp) {

        const rt = Router();
        const unsafe = Router();

        unsafe.post("/submit/:method", async (req, resp) => {
            // body is biz content
            const bizContent = req.body;
            const {method} = req.params;

            if (typeof method === "string") {
                alipay.request(method, bizContent)
                    .then(r => resp.json(r))
                    .catch(() => resp.status(500).end());

            } else {
                resp.status(400).end();
            }
        });

        rt.post("/ack/:method", async (req, resp) => {
            const method = req.params.method;
            let requestOptions = alipay.getRequestOptions(method);

            if (typeof requestOptions.onNotify === "function") {
                requestOptions.onNotify(req.body, alipay)
                    .then(() => resp.send(SUCCESS))
                    .catch(() => resp.send(ERROR));
            } else {
                resp.send(SUCCESS);
            }
        });

        rt.post("/sign/:method", (req, resp) => {
            const method = req.params.method;
            resp.json(alipay.sign(method, req.body));
        });

        rt.post("/encrypt", (req, resp) => {
            resp.send(alipay.encrypt(req.body));
        });

        unsafe.post("/decrypt", (req, resp) => {
            resp.send(alipay.decrypt(req.body.toString()));
        });

        expressApp.use(alipayMountPoint, rt);
        expressApp.use(unsafeMountPoint, unsafe);
    }

    return alipay;
}
