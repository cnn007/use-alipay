"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAlipay = exports.Alipay = exports.alipayCertSN = void 0;
const crypto_1 = require("crypto");
const buffer_1 = require("buffer");
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
// -- Constants
const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";
const DEFAULT_ALIPAY_SIGN_TYPE = "RSA2";
const ALIPAY_MOUNT_POINT = "/alipay";
const UNSAFE_MOUNT_POINT = "/unsafe/alipay";
const ALIPAY_ROOT_CERT_SN = "687b59193f3f462dd5336e5abf83c5d8_02941eef3187dddf3d3b83462e1dfcf6";
const SUCCESS = "success";
const ERROR = "error";
const DEFAULT_REQUEST_OPTS = {
    encrypt: false,
    notify: false,
};
// -- End constants
function alipayCertSN(x509) {
    const issuer = x509.issuer.split("\n").reverse().join(",");
    const sn = BigInt(`0x${x509.serialNumber}`).toString(10);
    return (0, crypto_1.createHash)("md5")
        .update(issuer, "utf8")
        .update(sn, "utf8")
        .digest("hex");
}
exports.alipayCertSN = alipayCertSN;
class ByteBuffer {
    constructor(buf, pos = 0) {
        this.buf = buf;
        this.pos = pos;
    }
    write(string) {
        const pos = this.pos;
        const bytes = this.buf.write(string, this.pos);
        // UTF-8 is 1~4 byte(s)
        if (bytes >= this.buf.length - pos - 4) {
            this.buf = buffer_1.Buffer.alloc(this.buf.length << 1, this.buf);
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
class Alipay {
    constructor(config, options) {
        this.tmpBuffer = buffer_1.Buffer.alloc(1024 * 1024);
        const { appId, appAuthToken, baseNotifyURL, gateway = ALIPAY_GATEWAY, signType = DEFAULT_ALIPAY_SIGN_TYPE, charset = "utf-8", version = "1.0", format = "JSON", encryptKey, } = config;
        this.appId = appId;
        this.appAuthToken = appAuthToken;
        this.baseNotifyURL = baseNotifyURL;
        this.version = version;
        this.signType = signType;
        this.charset = charset;
        this.format = format;
        this.encryptKey = encryptKey;
        this.appPrivateKey = (0, crypto_1.createPrivateKey)(config.appPrivateKey);
        let x509;
        if (config.appPublicKey) {
            x509 = new crypto_1.X509Certificate(config.appPublicKey);
            this.appPublicKey = x509.publicKey;
            this.appPublicKeySN = alipayCertSN(x509);
            this.alipayRootPublicKeySN = ALIPAY_ROOT_CERT_SN;
        }
        if (config.alipayPublicKey) {
            x509 = new crypto_1.X509Certificate(config.alipayPublicKey);
            this.alipayPublicKey = x509.publicKey;
            this.alipayPublicKeySN = alipayCertSN(x509);
        }
        if (config.alipayRootPublicKey) {
            x509 = new crypto_1.X509Certificate(config.alipayRootPublicKey);
            this.alipayRootPublicKey = x509.publicKey;
        }
        const { requestTimeoutMs, keepAlive = true, proxy } = options;
        const pkg = require("../package.json");
        this.axios = axios_1.default.create({
            baseURL: gateway,
            timeout: requestTimeoutMs,
            proxy,
            headers: {
                "User-Agent": `use-alipay/${pkg.version}`,
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
        this.requestOptionsMap = new Map();
    }
    getRequestOptions(method) {
        return this.requestOptionsMap.get(method) || DEFAULT_REQUEST_OPTS;
    }
    async signRequest(config) {
        let { data } = config;
        const method = config.url || "";
        config.params = this.sign(method, data);
        config.url = undefined;
        return config;
    }
    async verifyResponse(response) {
        // response.request;
        console.log("response", response.status, response.headers, response.data);
        return response;
    }
    encrypt(data) {
        if (typeof this.encryptKey === "string") {
            const iv = buffer_1.Buffer.alloc(16, 0);
            const key = buffer_1.Buffer.from(this.encryptKey, "base64");
            const cipher = (0, crypto_1.createCipheriv)("aes-128-cbc", key, iv);
            cipher.update(data);
            return cipher.final("base64");
        }
        else {
            return ERROR;
        }
    }
    decrypt(data) {
        if (typeof this.encryptKey === "string") {
            const key = buffer_1.Buffer.from(this.encryptKey, "base64");
            const iv = buffer_1.Buffer.alloc(16, 0);
            const decipher = (0, crypto_1.createDecipheriv)("aes-128-cbc", key, iv);
            return decipher.final("utf8");
        }
        else {
            return ERROR;
        }
    }
    // Sign a request
    sign(method, body) {
        const requestOpts = this.getRequestOptions(method);
        let notify_url, sign, timestamp = (0, date_fns_1.format)(new Date(), "yyyy-MM-dd HH:mm:ss"), biz_content;
        if (requestOpts.notify && this.baseNotifyURL) {
            notify_url = `${this.baseNotifyURL}/ack/${method}`;
        }
        const { appId: app_id, appAuthToken: app_auth_token, format, version, charset, signType: sign_type, appPublicKeySN: app_cert_sn, alipayRootPublicKeySN: alipay_root_cert_sn, } = this;
        biz_content = typeof biz_content === "string" ? biz_content : JSON.stringify(body);
        if (requestOpts.encrypt) {
            biz_content = this.encrypt(biz_content);
        }
        const params = [
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
        let buf = params.sort().reduce((b, p) => {
            if (p[1]) {
                b.write("&")
                    .write(p[0])
                    .write("=")
                    .write(p[1]);
            }
            return b;
        }, new ByteBuffer(this.tmpBuffer));
        sign = (0, crypto_1.createSign)("RSA-SHA256")
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
    async request(method, bizContent) {
        console.log("method", method, "biz_content", bizContent);
        return this.axios.post(method, bizContent).then(response => response.data);
    }
}
exports.Alipay = Alipay;
/**
 * Create alipay sdk
 */
function useAlipay(config, options = {}) {
    const alipay = new Alipay(config, options);
    const { expressApp, alipayMountPoint = ALIPAY_MOUNT_POINT, unsafeMountPoint = UNSAFE_MOUNT_POINT, } = options;
    if (expressApp) {
        const rt = (0, express_1.Router)();
        const unsafe = (0, express_1.Router)();
        unsafe.post("/submit/:method", async (req, resp) => {
            // body is biz content
            const bizContent = req.body;
            const { method } = req.params;
            if (typeof method === "string") {
                alipay.request(method, bizContent)
                    .then(r => resp.json(r))
                    .catch((e) => {
                    resp.status(500).end();
                    console.log("submit", e);
                });
            }
            else {
                resp.status(400).end();
            }
        });
        rt.post("/ack/:method", async (req, resp) => {
            const method = req.params.method;
            let requestOptions = alipay.getRequestOptions(method);
            if (typeof requestOptions.onNotify === "function") {
                requestOptions.onNotify(req.body, alipay)
                    .then(() => resp.send(SUCCESS))
                    .catch((e) => {
                    resp.send(ERROR);
                    console.log(e);
                });
            }
            else {
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
exports.useAlipay = useAlipay;
