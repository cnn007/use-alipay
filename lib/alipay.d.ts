

export interface AlipayResponseBase {
    code: string;
    msg: string;
}

export interface AlipayErrorResponse extends AlipayResponseBase {
    sub_code?: string;
    sub_msg?: string;
}

export interface AlipayResponse {
    sign: string;

}

export interface AlipayRequest {
    app_id: string;
    method: string;
    format?: string;
    charset: string;
    sign_type: "RSA2" | "RSA";
    sign: string;
    timestamp: string;
    version: string;
    app_auth_token?: string;
    biz_content: string;
    notify_url?: string;
}

export interface AlipayRequestOptions {
    method: string;

    encrypt?: boolean;

    notify?: boolean;

    responseKey?: string;

}

export const ALIPAY_DEFAULT_REQUEST_OPTS: AlipayRequestOptions = {
    encrypt: false,
    notify: false,
    responseKey: undefined,
};

export interface Goods {
    goods_id: string;
    goods_name: string;
    quantity: number;
    price: number;
    goods_category?: string;
    categories_tree?: string;
    show_url?: string;
}

export interface CreateOrderRequest {
    out_trade_no: string;

    total_amount: number;

    subject: string;

    product_code?: string;

    seller_id?: string;

    body?: string;

    goods_detail?: Goods[];

    discountable_amount?: number;

    store_id?: string;
    operator_id?: string;
    terminal_id?: string;

    merchant_order_no?: string;
}

export interface CreateOrderResponse extends AlipayResponse {
    out_trade_no: string;
    qr_code: string;
}
