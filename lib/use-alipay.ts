import {Alipay, AlipayConfig} from "../index";
import {Express, Router} from "express";
import axios, {Axios} from "axios";
import {AlipayRequest, AlipayRequestOptions, CreateOrderRequest, CreateOrderResponse} from "./alipay";
import * as https from "https";

export const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";

// The default sign type
export const RSA2 = "RSA2";

// Legacy sign type
export const RSA = "RSA";

export type AlipaySignType = "RSA2" | "RSA";

export interface Cert {
    path?: string;
    raw?: string | Buffer;
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
    appPrivateKey: string;

    signType?: AlipaySignType;

    // X.509
    appCertPath: string;
    alipayPublicCertPath: string;
    alipayRootCertPath: string;

    appPublicKeyCert: Cert;
    alipayPublicKeyCert: Cert;
    alipayRootCert: Cert;

    // AES key
    encryptKey?: string;

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

    // version is fixed
    version: string;

    // biz_content format, only accepts JSON
    format: string;

    charset: string;

    appCert: string;
    appCertSN: string;
    alipayPublicCert: string;
    alipayCertSN: string;
    alipayRootCert: string;
    alipayRootCertSN: string;


    requestConfigMap: Map<string, AlipayRequestOptions>;

    constructor(config: AlipayConfig) {
        this.appId = config.appId;
        this.appAuthToken = config.appAuthToken;
        this.encryptKey = config.encryptKey;
        this.baseNotifyURL = config.baseNotifyURL;

        const {
            gateway = ALIPAY_GATEWAY,
            signType = RSA2,
            charset = "utf-8",
            version = "1.0",
            format = "JSON",
        } = config;

        this.version = version;
        this.signType = signType;
        this.charset = charset;
        this.format = format;


        this.axios = axios.create({
            baseURL: gateway,
            httpsAgent: new https.Agent({
                keepAlive: true,
            }),
        });

        this.axios.interceptors.request.use((requestConfig) => {

            let alipayMethod;
            let {data, method} = requestConfig;

            if (method === "post" && (alipayMethod = data.method)) {

                const req = this.sign(alipayMethod, data);


                requestConfig.params = req;
                requestConfig.data = null;
            }



        });

        this.axios.interceptors.response.use((axiosResponse) => {
            const {config} = axiosResponse;



        });
    }

    setAppAuthToken(appAuthToken: string): Alipay {
        this.appAuthToken = appAuthToken;
        return this;
    }

    signRequest() {

    }

    verifyResponse() {

    }

    // Sign a request
    sign(method: string, request: any, requestOpts: AlipayRequestOptions): AlipayRequest {


        // bizContent to json string
        // encrypt if required


        // how to signer

        let notify_url, sign, timestamp, biz_content;

        if (requestOpts.notify && this.notifyUrlBase) {
            notify_url = this.notifyUrlBase + "/ack/" + requestOpts.method;
        }

        const {
            appId: app_id,
            appAuthToken: app_auth_token,
            format,
            charset,
            signType: sign_type,
        } = this;


        biz_content = JSON.stringify(request);
        if (requestOpts.encrypt && this.encryptKey) {
            biz_content = "";
        }

        // sort
        
        // buffer

        let buf = new Buffer(charset);

        // the order is fixed ...


        // sign the buffer

        sign = "";




        return {
            app_id,
            method,
            format,
            charset,
            sign_type,
            sign,
            timestamp,
            app_auth_token,
            biz_content,
            notify_url,

        };
    }

    // api: xx
    async createOrder(cor: CreateOrderRequest): Promise<CreateOrderResponse> {

        return new Promise(((resolve, reject) => {
            axios.request({
                method: "post",
                data: cor
            });




        }));
    }

    queryOrder() {

    }
}

export interface AlipayOption {
    config: AlipayConfig;

    express?: Express;

    axios: Axios;
}

/**
 * Create alipay sdk
 * @param options
 */
export function useAlipay(options: AlipayOption, expressApp: Express): Alipay {


    const alipay = new Alipay({});


    if (expressApp) {

        const r = Router();

        r.post("/submit/:method", async (req, resp) => {
            // body is biz content

            const biz_content = req.body;

            // app_id, ...

            // sign

            // request with alipay

            // send response

        });

        r.post("/ack/:method", async (req, resp) => {

            // Handle alipay notify


            resp.send("success");
        });


        expressApp.use("/alipay", r);
    }


    return alipay;

}
