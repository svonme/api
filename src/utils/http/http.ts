/**
 * @file 封装数据请求
 * @author svon.me@gmail.com
 */

import _ from "lodash-es";
import AxiosHttp from "axios";
import * as template from "./template";
import { useAsyncState, UseAsyncStateOptions } from "@vueuse/core";
import type { Axios, AxiosRequestConfig, AxiosResponse } from "axios";

type reqCallback = (req: AxiosRequestConfig) => AxiosRequestConfig;
type resCallback = (res: AxiosResponse) => AxiosResponse;

const request = new Set<reqCallback>();
const response = new Set<resCallback>();
const env = new Map<string, string | number>();

class Basis {
  public env: object;
  constructor(value = {}) {
    this.env = value;
    this.CallbackError = this.CallbackError.bind(this);
    this.requestCallback = this.requestCallback.bind(this);
  }
  static addRequest(callback: reqCallback) {
    if (callback) {
      request.add(callback);
    }
  }
  static addResponse(callback: resCallback) {
    if (callback) {
      response.add(callback);
    }
  }
  static setEnv (data = {}) {
    for (const key of Object.keys(data)) {
      // @ts-ignore
      const value = data[key];
      env.set(key, value);
    }
  }
  async CallbackError(value: any) {
    const code: number = _.get<object, string>(value, "code");
    if (code === 0) {
      return value;
    }
    return Promise.reject(value);
  }
  // 响应前拦截
  async requestCallback(req: AxiosRequestConfig) {
    // 替换 url 中的宏变量
    if (req.url && template.regExpText(req.url) && (req.params || req.data)) {
      
      const data = Object.assign({}, Object.fromEntries(env), this.env, req.params || {});
      if (req.data && (req.data instanceof FormData === false)) {
        Object.assign(data, req.data);
      }

      req.url = template.template(req.url, function($1: string, $2: string) {
        const value = _.get<object, string>(data, $2);
        if (value && _.isString(value) && value.includes("/")) {
          return value;
        }
        return `/${value}`;
      });
    }
    return req;
  }

  protected getAxios(config: AxiosRequestConfig = {}): Axios {
    const option: AxiosRequestConfig = Object.assign({
      baseURL: "/",
      timeout: 1000 * 5, // 超时时间
      maxRedirects: 3,   // 支持三次重定向
      withCredentials: false,
    }, config);
    const axios = AxiosHttp.create(option);
    // 响应时拦截
    axios.interceptors.request.use(this.requestCallback, this.CallbackError);
    for (const callback of request) {
      axios.interceptors.request.use(callback, this.CallbackError);
    }
    for (const callback of response) {
      axios.interceptors.response.use(callback, this.CallbackError);
    }
    return axios;
  }
}

export class Http extends Basis{
  public axios: Axios;
  constructor(config: AxiosRequestConfig = {}, env = {}) {
    super(env);
    this.axios = this.getAxios(config);
  }
  get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) {
    return this.axios.get<T, R, D>(url, config);
  }
  delete<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) {
    return this.axios.delete<T, R, D>(url, config);
  }

  getUri(config?: AxiosRequestConfig): string {
    return this.axios.getUri(config);
  }

  head<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) {
    return this.axios.head<T, R, D>(url, config);
  }

  options<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) {
    return this.axios.options<T, R, D>(url, config);
  }

  patch<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return this.axios.patch<T, R, D>(url, data, config);
  }

  post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return this.axios.post<T, R, D>(url, data || ({} as D), config);
  }

  put<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) {
    return this.axios.put<T, R, D>(url, data, config);
  }

  request<T = any, R = AxiosResponse<T>, D = any>(config: AxiosRequestConfig<D>) {
    return this.axios.request<T, R, D>(config);
  }
}


export class useState {
  // 获取数据
  static data<T = any, Shallow extends boolean = true>(
    api: Promise<T> | ((...args: any[]) => Promise<T>), 
    initialState?: T, 
    options?: UseAsyncStateOptions<Shallow>
  ) {
    const app = async function(...args: any[]) {
      if (_.isFunction(api)) {
        return api(...args);
      }
      return Promise.resolve(api);
    };
    // @ts-ignore
    return useAsyncState<T>(app, initialState || {}, options);
  }
  // 获取列表数据
  static dataExecute<T = any, Shallow extends boolean = true>(
    api: ((...args: any[]) => Promise<T>), 
    initialState?: T, 
    options: UseAsyncStateOptions<Shallow> = {
      immediate: false,
      resetOnExecute: false
    }
  ) {
    return useState.data(api, initialState, options)
  }
}