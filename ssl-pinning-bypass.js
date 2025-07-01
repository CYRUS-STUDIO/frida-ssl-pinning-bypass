// 绕过 OkHttp 的 CertificatePinner
function bypassCertificatePinner() {
    Java.perform(function () {
        var CertificatePinner = Java.use("okhttp3.CertificatePinner");

        // Hook OkHttp 3 的 check(hostname, peerCertificates)
        try {
            var checkMethod = CertificatePinner.check.overload('java.lang.String', 'java.util.List');
            checkMethod.implementation = function (hostname, peerCertificates) {
                console.log('[Bypass] OkHttp3 CertificatePinner.check() called, bypassed -> ' + hostname);
                return;
            };
            console.log('[+] Hooked okhttp3.CertificatePinner.check');
        } catch (e) {
            console.warn('[-] Failed to hook CertificatePinner.check:', e);
        }

        // Hook OkHttp 4 Kotlin 生成的 check$okhttp 方法（如果存在）
        try {
            if (CertificatePinner.check$okhttp) {
                CertificatePinner.check$okhttp.implementation = function (hostname, peerCertificates) {
                    console.log('[Bypass] OkHttp4 CertificatePinner.check$okhttp() called, bypassed -> ' + hostname);
                    return;
                };
                console.log('[+] Hooked okhttp3.CertificatePinner.check$okhttp');
            } else {
                console.log('[!] No check$okhttp method found (likely not OkHttp4)');
            }
        } catch (e) {
            console.warn('[-] Failed to hook check$okhttp:', e);
        }
    });
}


// 替换 TrustManager 验证逻辑
function bypassTrustManager() {
    //Universal Android SSL Pinning Bypass #2
    Java.perform(function () {
        try {
            var array_list = Java.use("java.util.ArrayList");
            var ApiClient = Java.use('com.android.org.conscrypt.TrustManagerImpl');
            if (ApiClient.checkTrustedRecursive) {
                console.log("[*][+] Hooked checkTrustedRecursive")
                ApiClient.checkTrustedRecursive.implementation = function (a1, a2, a3, a4, a5, a6) {
                    var k = array_list.$new();
                    return k;
                }
            } else {
                console.log("[*][-] checkTrustedRecursive not Found")
            }
        } catch (e) {
            console.log("[*][-] Failed to hook checkTrustedRecursive")
        }
    });

    Java.perform(function () {
        try {
            const x509TrustManager = Java.use("javax.net.ssl.X509TrustManager");
            const sSLContext = Java.use("javax.net.ssl.SSLContext");

            // 一个 “接受所有证书的 TrustManager”
            const TrustManager = Java.registerClass({
                implements: [x509TrustManager],
                methods: {
                    checkClientTrusted(chain, authType) {
                    },
                    checkServerTrusted(chain, authType) {
                    },
                    getAcceptedIssuers() {
                        return [];
                    },
                },
                name: "com.abc.ssl.pinning.TrustManager",
            });
            const TrustManagers = [TrustManager.$new()];

            const SSLContextInit = sSLContext.init.overload(
                "[Ljavax.net.ssl.KeyManager;", "[Ljavax.net.ssl.TrustManager;", "java.security.SecureRandom");
            SSLContextInit.implementation = function (keyManager, trustManager, secureRandom) {
                // 忽略传进来的 trustManager 参数，使用自定义的 TrustManagers 替换它。
                SSLContextInit.call(this, keyManager, TrustManagers, secureRandom);
            };
            console.log("[*][+] Hooked SSLContextInit")
        } catch (e) {
            console.log("[*][-] Failed to hook SSLContextInit")
        }
    })
}


// 等待模块加载
function waitForModule(moduleName) {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const m = Process.findModuleByName(moduleName);
            if (m !== null) {
                clearInterval(interval);
                resolve(m);
            }
        }, 100); // 每 100ms 检查一次
    });
}


/**
 * 绕过 SSL_CTX_set_verify 设置的证书验证回调
 * 原型: void SSL_CTX_set_verify(SSL_CTX *ctx, int mode, int (*callback)(int, X509_STORE_CTX*))
 * 实现方式：将 callback 替换为总是返回 1 的函数（表示验证通过）
 */
function bypassSslCtxSetVerify() {
    const symbolName = "SSL_CTX_set_verify";

    const modules = Process.enumerateModules();
    let hooked = false;

    for (const module of modules) {
        const addr = Module.findExportByName(module.name, symbolName);
        if (!addr) continue;

        const start = module.base;
        const end = start.add(module.size);

        if (addr.compare(start) >= 0 && addr.compare(end) < 0) {
            console.log(`✅ 找到 ${symbolName} @ ${addr} 属于模块: ${module.name}`);
            console.log(`➤ 模块路径: ${module.path}`);
            console.log(`➤ 模块地址范围: [${start} - ${end}]`);

            // 构造伪造回调：始终返回 1（表示验证成功）
            const fakeCallback = new NativeCallback(function (preverify_ok, x509_ctx) {
                console.log("[Bypass] SSL verify callback 被调用，强制返回 1（通过）");
                return 1;
            }, 'int', ['int', 'pointer']);

            Interceptor.attach(addr, {
                onEnter(args) {
                    const originalCb = args[2];
                    console.log(`[Hooked] 替换 SSL_CTX_set_verify 原始回调 ${originalCb} 为伪造回调`);
                    args[2] = fakeCallback;
                }
            });

            hooked = true;
            // break; // 只 Hook 第一个匹配项
        }
    }

    if (!hooked) {
        console.warn(`❌ 未找到符号 ${symbolName} 或未在模块内`);
    }
}


/**
 * 绕过 BoringSSL 的 SSL_CTX_set_custom_verify 自定义证书验证
 * @param {string} moduleName - 包含 SSL_CTX_set_custom_verify 的模块名（如 libttboringssl.so）
 */
function bypassBoringSslCustomVerify(moduleName) {
    waitForModule(moduleName).then((mod) => {
        const funcName = "SSL_CTX_set_custom_verify";
        const addr = Module.findExportByName(mod.name, funcName);
        if (!addr) {
            console.warn(`[!] 未找到符号 ${funcName}`);
            return;
        }

        const SSL_CTX_set_custom_verify = new NativeFunction(addr, 'void', ['pointer', 'int', 'pointer']);
        const hook_callback = (callbackPtr) => {
            const cb = new NativeFunction(callbackPtr, 'int', ['pointer', 'pointer']);
            Interceptor.attach(cb, {
                onLeave(retval) {
                    retval.replace(0); // ssl_verify_ok
                }
            });
        };

        Interceptor.replace(SSL_CTX_set_custom_verify, new NativeCallback((ssl, mode, cb) => {
            hook_callback(cb);
            SSL_CTX_set_custom_verify(ssl, mode, cb);
        }, 'void', ['pointer', 'int', 'pointer']));

        console.log(`[Bypass] Hooked ${funcName} in ${mod.name}`);
    });
}


setImmediate(function () {
    bypassCertificatePinner()
    bypassTrustManager()
    // bypassSslCtxSetVerify();
    bypassBoringSslCustomVerify("libttboringssl.so"); // 抖音系
});


// frida -H 127.0.0.1:1234 -F -l ssl-pinning-bypass.js
// frida -H 127.0.0.1:1234 -l ssl-pinning-bypass.js -f com.ss.android.ugc.aweme