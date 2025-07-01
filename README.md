> 版权归作者所有，如有转发，请注明文章出处：<https://cyrus-studio.github.io/blog/>

# Android 下常见反抓包方案



常见反抓包手段：

- No Proxy（禁用代理）

- 启用 HTTPS + SSL Pinning

- 使用 DNS-over-HTTPS / DoT（隐藏 DNS 请求）

- 检查系统代理（Java 层检查 System.getProperty("http.proxyHost")）

- 检测 VPN 或 adb 代理

- 使用 native 层自己实现网络请求（绕过 Java 层）

- 证书双向校验



# No Proxy（无代理模式）



所谓 “无代理模式” 实际上是通过主动避免走系统代理，从而规避传统的中间人抓包。



设置 OkHttp 不使用系统代理，直接访问服务器：

```
val client = OkHttpClient.Builder()
    .proxy(Proxy.NO_PROXY) // 禁用系统代理
    .build()
```


设置 NO_PROXY 后，Charles 并没有抓取到 httpbin.org 相关请求



![word/media/image1.png](https://gitee.com/cyrus-studio/images/raw/master/95f112f969eccf668630e0e9d2c7f79d.png)


App 中请求 httpbin.org 正常



![word/media/image2.png](https://gitee.com/cyrus-studio/images/raw/master/540629feeeab8441e119bc5cde3b64d7.png)


# 通过 VPN 绕过 No Proxy



如果使用 VPN 或全局代理，NO_PROXY 也无法绕过抓包。比如，通过第三方代理应用 Drony 强制 APP 走代理。



Drony 是一款强大的 Android 代理客户端，支持认证代理、多协议、PAC 脚本、规则过滤及 DNS 加密，且无需 root。



下载 Drony：[https://drony.en.uptodown.com/android/download](https://drony.en.uptodown.com/android/download)



网络 — 不是无线网络



![word/media/image3.png](https://gitee.com/cyrus-studio/images/raw/master/a984ab8ce91dd0eb5b31d4c723b9377d.png)


设置 PC 的代理 IP 地址和端口



![word/media/image4.png](https://gitee.com/cyrus-studio/images/raw/master/efcb1bcd7c1c0dc129386c5cbef0cd41.png)


在 “Log” 页点击 ON/OFF 开关；



![word/media/image5.png](https://gitee.com/cyrus-studio/images/raw/master/c6c49d6a6e067473b9751fdb20ad63ac.png)


系统状态栏将出现 VPN 图标，表示代理已生效



![word/media/image6.png](https://gitee.com/cyrus-studio/images/raw/master/d14b07137ddd7dd5a9ca305c6263893a.png)


这时候 Charles 能正常抓包 NO_PROXY 的 OkHttp 请求了。



![word/media/image7.png](https://gitee.com/cyrus-studio/images/raw/master/e5ffd9bb9c12b50954232d7bb6f2bdbc.png)


# 检测 VPN



通过代码检测 VPN 是否活跃

```
/**
 * 检测 VPN 是否活跃
 */
fun isVpnActive(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return false
    val networks = connectivityManager.allNetworks
    for (network in networks) {
        val caps = connectivityManager.getNetworkCapabilities(network)
        if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
            return true
        }
    }
    return false
}
```


效果如下：



![word/media/image8.png](https://gitee.com/cyrus-studio/images/raw/master/e231fc36a27cd473a3079ecbe5a99160.png)


# ADB 代理抓包的原理



1、在 PC 上启动抓包代理，例如：

- Charles、Burp Suite、mitmproxy

- 监听端口：127.0.0.1:8888



![word/media/image9.png](https://gitee.com/cyrus-studio/images/raw/master/4417b1278abfd0691f10eabd543400e6.png)


2、通过 ADB 命令将 Android 的 HTTP/HTTPS 流量重定向到主机代理端口：

```
adb shell settings put global http_proxy 127.0.0.1:8888
```
这会在设备系统层设置代理，但不会在 Wi-Fi 设置中显示。




3、启用 TCP 端口转发（USB 隧道）：

```
adb reverse tcp:8888 tcp:8888
```
表示让设备端口 8888 流量经由 USB 隧道转发到电脑的 127.0.0.1:8888




4、设备中所有默认使用 HTTP 代理的流量（如 WebView、默认 Java 网络库）将经过代理服务，可被抓包。



![word/media/image10.png](https://gitee.com/cyrus-studio/images/raw/master/effb6334a0a86a365fcbe317fbe2625e.png)


设置代理：

```
adb shell settings put global http_proxy 127.0.0.1:8888
```
清除代理：

```
adb shell settings put global http_proxy :0
```
检查当前代理设置：

```
adb shell settings get global http_proxy
```


# ADB 代理辅助脚本



ADB 代理辅助脚本（Windows .bat 文件），支持以下功能：

- 选项 1：设置系统代理 + 设置 adb reverse 转发

- 选项 2：清除系统代理

- 选项 3：查看当前代理设置



ADB 代理助手.bat

```
@echo off
setlocal enabledelayedexpansion

:: 默认代理配置
set PROXY_HOST=127.0.0.1
set PROXY_PORT=8888

:MENU
echo.
echo ==== ADB 代理助手 ====
echo [1] 设置系统代理并启用 adb reverse 转发（%PROXY_HOST%:%PROXY_PORT%）
echo [2] 清除代理
echo [3] 查看当前代理设置
echo [0] 退出
echo.

set /p choice=请选择操作 [0-3]:

if "%choice%"=="1" goto SET_ALL
if "%choice%"=="2" goto CLEAR_PROXY
if "%choice%"=="3" goto CHECK_PROXY
if "%choice%"=="0" exit

goto MENU

:SET_ALL
echo 正在设置系统代理为 %PROXY_HOST%:%PROXY_PORT% ...
adb shell settings put global http_proxy %PROXY_HOST%:%PROXY_PORT%

echo 正在启用 adb reverse 转发：tcp:%PROXY_PORT% -> tcp:%PROXY_PORT% ...
adb reverse tcp:%PROXY_PORT% tcp:%PROXY_PORT%

echo 完成设置。
goto MENU

:CLEAR_PROXY
echo 正在清除系统代理...
adb shell settings put global http_proxy :0
echo 已清除。
goto MENU

:CHECK_PROXY
echo 当前代理设置为：
adb shell settings get global http_proxy
goto MENU
```


执行效果如下：



![word/media/image11.png](https://gitee.com/cyrus-studio/images/raw/master/a65e21a455c27d52f6d530633e263ea8.png)


# 如何检测和防御 ADB 代理？



通过代码检测 ADB 代理，或者 No Proxy 也能绕过 ADB 代理。

```
/**
 * 检测是否通过 ADB 设置了 HTTP 代理（常用于抓包）
 */
fun isAdbProxyEnabled(): Boolean {
    val proxyHost = System.getProperty("http.proxyHost")
    val proxyPort = System.getProperty("http.proxyPort")
    if (proxyHost == "127.0.0.1" && proxyPort == "8888") {
        // 可能为 adb proxy 抓包
        return true
    }
    return false
}
```


效果如下：



![word/media/image12.png](https://gitee.com/cyrus-studio/images/raw/master/cffd6194043223069327799e09970bc6.png)


# SSL Pinning



SSL Pinning（证书锁定） 是指 App 在客户端中内置并只信任特定的服务器证书或公钥，而不是信任系统或第三方根证书。



常见方式：

| 类型 | 描述 |
|--- | ---|
| 证书级 Pinning | 验证服务端证书是否与内置证书完全一致 |
| 公钥级 Pinning | 提取服务端证书的公钥并进行匹配 |
| SPKI Hash | 校验公钥 DER 格式的 SHA-256 哈希是否匹配 |


# OkHttp 如何实现 SSL Pinning？



## 1. 提取服务器公钥



运行下面命令：

```
openssl s_client -connect httpbin.org:443 -servername httpbin.org | openssl x509 -pubkey -noout
```


命令分解与解释：

```
openssl s_client -connect httpbin.org:443 -servername httpbin.org
```
- 与服务器建立 TLS 握手连接，获取其证书信息。

- -servername 是为了支持 SNI（Server Name Indication），确保你拿到的是 httpbin.org 对应的证书（因为有些服务器用一个 IP 对多个域名）。



```
 openssl x509 -pubkey -noout
```
- 从 TLS 握手输出中提取出服务器证书。

- 只保留公钥部分（Subject Public Key Info），不打印其他字段。



成功提取出了 httpbin.org 的 服务器公钥（Subject Public Key Info，SPKI）：

```
$ openssl s_client -connect httpbin.org:443 -servername httpbin.org | openssl x509 -pubkey -noout
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoBmTvGfU3HfQlGgP9glK
W5k35nWd4W4KKela7JM46C+UOQ0TyBVJfI6tZ8tSIhNDjFLntyrxLWvBsSc6Df5H
gP9YRe4vf6r21ikBpdxSpKy6H/ZUbEG7IBWadbvb6gf6KSyhYeo9gSXWgquF+AkA
SAZCLwNbmduhR8KpXIKj1Ech1DLVrhy1ljdLDGV05g//RY+EOxRRpI1O91fA2+j5
aR64Ldh5+uIt/OPDq2FFrSUlYTgUnamExJcnD+4gGFmYs5viVikQJGoxQDvxoCie
j6YOLt5kliaoJIQSCovvl16RV/Pgn1fCAZ2kRjHy+VCiR+DgWnVSXUIfFgInWDVl
8wIDAQAB
-----END PUBLIC KEY-----
```


把服务器公钥信息保存为  pubkey.pem



![word/media/image13.png](https://gitee.com/cyrus-studio/images/raw/master/237d6ca81fbaf31809a4f381cc57b3ac.png)


## 2. 获取 OkHttp 所需的公钥哈希



注意：Windows 下 openssl 在管道处理 PEM → DER → digest 时经常出错，建议使用 WSL、Git Bash。



![word/media/image14.png](https://gitee.com/cyrus-studio/images/raw/master/f05e1f784bcd44ec6ca1bfb2515f8bc8.png)


执行下面命令：

```
openssl pkey -pubin -inform PEM -in pubkey.pem -outform DER | openssl dgst -sha256 -binary | openssl base64
```


输出如下：

```
$ cd /d/Python/anti-app/ssl-pinning
$ openssl pkey -pubin -inform PEM -in pubkey.pem -outform DER | openssl dgst -sha256 -binary | openssl base64
IFG+z/oQKXfpUYOHgWHy5axgkT9B01XSxwb2AHDyN34=
```


完整命令：

```
$ openssl s_client -connect httpbin.org:443 -servername httpbin.org | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | openssl base64
IFG+z/oQKXfpUYOHgWHy5axgkT9B01XSxwb2AHDyN34=
```


## 3. 在 OkHttp 中启用 SSL Pinning



封装启用 SPKI Hash Pinning 方法：

```
// 启用 SPKI Hash Pinning
fun enableSpkiSha256Pinning(domain: String, base64SpkiHash: String) {
    val pinner = CertificatePinner.Builder()
        .add(domain, "sha256/$base64SpkiHash")
        .build()
    sslPinnedClient = buildClient().newBuilder()
        .certificatePinner(pinner)
        .build()
}    

/**
 * 为多个域名启用 SPKI Hash 形式的 SSL Pinning。
 *
 * @param pins 一个映射，每个键为域名（如 "example.com"），对应值为该域名允许的 SPKI 哈希列表（Base64 编码，带或不带前缀 "sha256/"）。
 * 示例：
 * enableMultiDomainPinning(
 *     mapOf(
 *         "api.example.com" to listOf("Pz89eRE/Pz84Yj8/NgE/P09gP3M/DQo="),
 *         "cdn.example.org" to listOf("ABCDEF123456...", "ZYXWV09876...")
 *     )
 * )
 */
fun enableMultiDomainSpkiSha256Pinning(pins: Map<String, List<String>>) {
    val builder = CertificatePinner.Builder()
    for ((host, hashes) in pins) {
        hashes.forEach { hash ->
            builder.add(host, "sha256/$hash")
        }
    }
    sslPinnedClient = buildClient().newBuilder()
        .certificatePinner(builder.build())
        .build()
}
```


调用示例：

```
NetworkClient.enableSpkiSha256Pinning("httpbin.org", "IFG+z/oQKXfpUYOHgWHy5axgkT9B01XSxwb2AHDyN34=")
```


这样就启用了对 httpbin.org 的 SSL Pinning：

- 如果你使用抓包工具（如 Charles、Burp）伪造证书；

- 即使系统已安装了它们的根证书；

- 你的 App 也会因哈希不匹配而 拒绝连接 



## 4. 测试



在不被抓包的情况下，请求和响应都正常：



![word/media/image15.png](https://gitee.com/cyrus-studio/images/raw/master/9d453503207edb00aca0ff2131f1ae5e.png)


启用 ADB 代理 +  Charles 抓包：



![word/media/image16.png](https://gitee.com/cyrus-studio/images/raw/master/f870f64321b6b7e4dd874a75db22d5dc.png)
OkHttp 在发现服务端返回的证书链与本地预设的不一致时主动终止连接。



Charles 抓包失败



![word/media/image17.png](https://gitee.com/cyrus-studio/images/raw/master/860bb79483ffe302feadad024ff3fb20.png)
因为 Charles 替换了服务端证书，导致 OkHttp 校验的 SPKI 与实际返回的不一致，Pinning 校验失败，连接被拒绝。



连接失败报错如下：



![word/media/image18.png](https://gitee.com/cyrus-studio/images/raw/master/1edbfa34baf225d0c50cd98aa5999921.png)
这就说明 **SSL Pinning 已成功生效**  ✅



# 绕过 SSL Pinning 的几种方式



- Objection 一键绕过主流框架（如 OkHttp）

- Xposed 模块（JustTrustMe / SSLUnpinning）

- Frida 动态 Hook SSL校验逻辑并“放行”

- 通过逆向找到证书和证书密码，Charles 中导入证书

- ...



# Objection



Objection 被称为 “mobile runtime exploration toolkit”（移动端运行时嗅探工具），主要用于运行时分析 App 的行为。


- 项目地址：[https://github.com/sensepost/objection](https://github.com/sensepost/objection)

- 作者：由 SensePost 安全团队开发。

- 运行平台：支持 Android 和 iOS。

- 依赖：基于 [Frida](https://frida.re/) 实现，需要目标设备上运行 Frida Server。



关于 Frida 的使用参考：[一文搞懂如何使用 Frida Hook Android App](https://cyrus-studio.github.io/blog/posts/%E4%B8%80%E6%96%87%E6%90%9E%E6%87%82%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8-frida-hook-android-app/)



它类似于一个“交互式终端”，你可以在目标 App 运行时执行各种操作，比如：

- 检查和修改内存

- 调用原生或 Java 函数

- Hook 方法

- 绕过 SSL Pinning

- 文件系统访问（Android/iOS）

- 动态修改返回值

- 模拟点击、发送广播等



# 安装 Objection



你可以直接用 pip 安装：

```
pip install objection
```


确认安装成功：

```
objection --help
```


# 使用 Objection 一键绕过 SSL Pinning



## 1. 启动并附加到 Android App



通过 USB 链接：

```
objection -g com.cyrus.example explore
```


通过远程链接：

```
objection -N -h 127.0.0.1 -p 1234 -g com.cyrus.example explore
```


这会自动使用 frida 注入目标 App 并进入命令行模式。



## 2. 绕过 SSL Pinning

```
android sslpinning disable
```
一行命令即可绕过常见的 SSL Pinning 检查（基于 hook）。



## 3. 测试



日志输出如下：

```
(anti-app) PS D:\Python\anti-app> objection -N -h 127.0.0.1 -p 1234 -g com.cyrus.example explore
Using networked device @`127.0.0.1:1234`
Agent injected and responds ok!

     _   _         _   _
 ___| |_|_|___ ___| |_|_|___ ___
| . | . | | -_|  _|  _| | . |   |
|___|___| |___|___|_| |_|___|_|_|
      |___|(object)inject(ion) v1.11.0

     Runtime Mobile Exploration
        by: @leonjza from @sensepost

[tab] for command suggestions
com.cyrus.example on (Xiaomi: 10) [net] # android sslpinning disable
(agent) Custom TrustManager ready, overriding SSLContext.init()
(agent) Found okhttp3.CertificatePinner, overriding CertificatePinner.check()
(agent) Found okhttp3.CertificatePinner, overriding CertificatePinner.check$okhttp()
(agent) Found com.android.org.conscrypt.TrustManagerImpl, overriding TrustManagerImpl.verifyChain()
(agent) Found com.android.org.conscrypt.TrustManagerImpl, overriding TrustManagerImpl.checkTrustedRecursive()
(agent) Registering job 652765. Type: android-sslpinning-disable
com.cyrus.example on (Xiaomi: 10) [net] # (agent) [652765] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
(agent) [652765] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
(agent) [046339] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
(agent) [046339] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
(agent) [046339] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
(agent) [046339] Called (Android 7+) TrustManagerImpl.checkTrustedRecursive(), not throwing an exception.
```


但实际测试中发现并没有起效果，测试环境：Android 10，OkHttp 4.12.0



![word/media/image19.png](https://gitee.com/cyrus-studio/images/raw/master/600259e796d2c05f55d127cc9809ea5a.png)


# Objection 其他命令介绍



## 1. 查看活动组件

```
android hooking list activities
```


## 2. 查看加载的类和方法

```
android hooking list classes
android hooking list class_methods com.example.MyClass
```


## 3. Hook 方法并打印参数

```
android hooking watch class_method com.example.MyClass.myMethod
```


或者修改返回值：

```
android hooking set return_value com.example.MyClass.myMethod '123'
```


# Hook 证书校验函数绕过 SSL Pinning



## Java 层常见 Hook API：

| 方法所属类 | 方法 | 作用 |
|--- | --- | ---|
| javax.net.ssl.X509TrustManager | checkServerTrusted | 通用 SSL 校验方法 |
| javax.net.ssl.SSLContext | init(...) | 替换默认 TrustManager |
| okhttp3.CertificatePinner | check() 、check$okhttp() | OkHttp 专用 SSL Pinning |
| com.android.org.conscrypt.TrustManagerImpl | verifyChain() / checkTrustedRecursive() | Android 7+ 默认实现 |


### CertificatePinner



OkHttp 中 CertificatePinner 类的 check 方法。对某个主机名（hostname）对应的服务器证书列表 peerCertificates 进行 SSL Pinning 校验，若不匹配绑定的 hash 就会抛出 SSLPeerUnverifiedException 异常，拒绝连接。

```
  @Throws(SSLPeerUnverifiedException::class)
  fun check(
    hostname: String,
    peerCertificates: List<Certificate>,
  ) = check(hostname) {
    (certificateChainCleaner?.clean(peerCertificates, hostname) ?: peerCertificates)
      .map { it as X509Certificate }
  }
```
[https://github.com/square/okhttp/blob/9ba896295a4e7ee82641e04d8cb65c72c461793b/okhttp/src/commonJvmAndroid/kotlin/okhttp3/CertificatePinner.kt#L149](https://github.com/square/okhttp/blob/9ba896295a4e7ee82641e04d8cb65c72c461793b/okhttp/src/commonJvmAndroid/kotlin/okhttp3/CertificatePinner.kt#L149)



### TrustManagerImpl



checkTrustedRecursive 是 Android 默认证书验证中的核心方法，多数基于 TrustManagerImpl 的验证（如 OkHttp、WebView）都会走这。

```
private List<X509Certificate> checkTrustedRecursive(X509Certificate[] certs, byte[] ocspData,
        byte[] tlsSctData, String host, boolean clientAuth,
        ArrayList<X509Certificate> untrustedChain, ArrayList<TrustAnchor> trustAnchorChain,
        Set<X509Certificate> used) throws CertificateException 
```
[https://cs.android.com/android/platform/superproject/+/android10-release:external/conscrypt/repackaged/common/src/main/java/com/android/org/conscrypt/TrustManagerImpl.java;l=534](https://cs.android.com/android/platform/superproject/+/android10-release:external/conscrypt/repackaged/common/src/main/java/com/android/org/conscrypt/TrustManagerImpl.java;l=534)



checkTrustedRecursive 方法作用：递归地校验证书链的合法性，并返回最终信任的证书链列表（List\<X509Certificate>）。



通过 Frida 重写此方法的返回值，例如返回一个空的 ArrayList\<X509Certificate>()。这样可以直接跳过系统的证书校验，绕过 SSL Pinning。



### SSLContext



javax.net.ssl.SSLContext 的 init 方法实现如下：

```
public final void init(KeyManager[] km, TrustManager[] tm, SecureRandom random) throws KeyManagementException {
    contextSpi.engineInit(km, tm, random);
}
```
[https://cs.android.com/android/platform/superproject/+/android10-release:libcore/ojluni/src/main/java/javax/net/ssl/SSLContext.java;l=323](https://cs.android.com/android/platform/superproject/+/android10-release:libcore/ojluni/src/main/java/javax/net/ssl/SSLContext.java;l=323)



用于初始化当前的 SSLContext，配置它使用的 KeyManager（密钥管理器）、TrustManager（信任管理器）、SecureRandom（安全随机数生成器），从而建立一个安全的 TLS/SSL 会话环境。



可以通过 Hook Java 层的 SSLContext.init() 方法，并用自定义的 TrustManager 替换原本的 TrustManager，从而绕过 SSL Pinning 或信任检查。



## Native 层（OpenSSL、BoringSSL）常见 Hook 函数：



如果应用使用 native 实现（如 C/C++ 或使用 OpenSSL、BoringSSL），可以 Hook：

| 函数名称 | 说明 |
|--- | ---|
| SSL_get_peer_certificate | 获取服务器证书 |
| SSL_CTX_set_verify | 设置证书验证回调 |
| SSL_CTX_set_custom_verify | BoringSSL 的新方式 |
| X509_verify_cert | 验证证书链是否受信 |


### OpenSSL



在 OpenSSL 的头文件中，SSL_CTX_set_verify 原型如下：

```
// 定义一个类型别名：证书验证回调函数指针类型
// - preverify_ok：系统默认验证是否通过（1 表示通过，0 表示失败）
// - x509_ctx：包含证书链信息、验证状态等上下文对象
// 返回值：你自己的验证结果（返回 1 表示通过，0 表示拒绝）
typedef int (*SSL_verify_cb)(int preverify_ok, X509_STORE_CTX *x509_ctx);

// 设置证书验证的模式和回调函数
// - ctx：SSL 上下文对象（例如通过 SSL_CTX_new 创建）
// - mode：验证模式，常见取值包括：
//     - SSL_VERIFY_NONE：不验证对方证书
//     - SSL_VERIFY_PEER：验证对方证书（客户端验证服务器、服务器验证客户端）
// - callback：你自定义的验证函数（可用于修改验证逻辑，例如总是信任）
void SSL_CTX_set_verify(SSL_CTX *ctx, int mode, SSL_verify_cb callback);
```
[https://github.com/openssl/openssl/blob/master/include/openssl/ssl.h.in](https://github.com/openssl/openssl/blob/master/include/openssl/ssl.h.in)



preverify_ok=1 表示验证是否通过



![word/media/image20.png](https://gitee.com/cyrus-studio/images/raw/master/37783dae068421a86e866d32a47ca7b3.png)
[https://docs.openssl.org/3.5/man3/SSL_CTX_set_verify/#notes](https://docs.openssl.org/3.5/man3/SSL_CTX_set_verify/#notes)



常见验证模式（mode）

```
#define SSL_VERIFY_NONE                 0x00  // 不验证证书
#define SSL_VERIFY_PEER                0x01  // 验证对方证书
#define SSL_VERIFY_FAIL_IF_NO_PEER_CERT 0x02 // 双向验证时，若客户端无证书则失败（仅服务端有效）
#define SSL_VERIFY_CLIENT_ONCE         0x04  // 仅在初次握手时验证客户端
```


### BoringSSL



SSL_CTX_set_custom_verify 函数定义如下（BoringSSL）：

```
// 定义证书验证的结果枚举，用于自定义验证逻辑时返回结果
// 注意：这个是 BoringSSL 特有的（不同于 OpenSSL）
enum ssl_verify_result_t BORINGSSL_ENUM_INT {
  ssl_verify_ok,        // ✅ 验证成功，握手继续进行
  ssl_verify_invalid,   // ❌ 验证失败，握手终止（会发送 fatal alert）
  ssl_verify_retry,     // 🔁 可重试（比如需要等待异步操作完成）
};


// 设置自定义的证书验证函数，用于替代默认的证书验证逻辑
// @param ssl         当前连接的 SSL 对象
// @param mode        验证模式，取值参考 SSL_VERIFY_NONE / SSL_VERIFY_PEER 等（同 OpenSSL）
// @param callback    自定义的验证回调函数
//                   - 参数:
//                     * ssl: 当前连接对象
//                     * out_alert: 如果验证失败，你可以设置 TLS alert 类型（如 42 表示 `bad certificate`）
//                   - 返回值: 参见上面的 enum ssl_verify_result_t
//                       * ssl_verify_ok：信任证书（验证通过）
//                       * ssl_verify_invalid：拒绝证书（验证失败）
//                       * ssl_verify_retry：验证暂时无法完成（异步验证时可能用到）
OPENSSL_EXPORT void SSL_set_custom_verify(
    SSL *ssl,
    int mode,
    enum ssl_verify_result_t (*callback)(SSL *ssl, uint8_t *out_alert));
```
相关源码链接：

- [https://android.googlesource.com/platform/external/boringssl/+/refs/heads/master/src/include/openssl/ssl.h](https://android.googlesource.com/platform/external/boringssl/+/refs/heads/master/src/include/openssl/ssl.h)

- [https://boringssl.googlesource.com/boringssl/+/HEAD/ssl/ssl_lib.cc](https://boringssl.googlesource.com/boringssl/+/HEAD/ssl/ssl_lib.cc)



## Java + Native 全自动 SSL Pinning 绕过脚本



脚本代码如下：

```
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
    bypassBoringSslCustomVerify("libttboringssl.so"); // **系
});


// frida -H 127.0.0.1:1234 -F -l ssl-pinning-bypass.js
// frida -H 127.0.0.1:1234 -l ssl-pinning-bypass.js -f com.ss.android.ugc.aweme
```


## 测试



日志输出如下，可以看到 SSL 校验已被绕过。

```
(anti-app) PS D:\Python\anti-app\frida-ssl> frida -H 127.0.0.1:1234 -F -l ssl-pinning-bypass.js
     ____
    / _  |   Frida 14.2.18 - A world-class dynamic instrumentation toolkit
   | (_| |
    > _  |   Commands:
   /_/ |_|       help      -> Displays the help system
   . . . .       object?   -> Display information about 'object'
   . . . .       exit/quit -> Exit
   . . . .
   . . . .   More info at https://www.frida.re/docs/home/
[+] Hooked okhttp3.CertificatePinner.check
[+] Hooked okhttp3.CertificatePinner.check$okhttp
[✔] Hooking SSL_CTX_set_verify @ 0x7bf40e15b8 in libssl.so
[Remote::AndroidExample]-> [Bypass] OkHttp4 CertificatePinner.check$okhttp() called, bypassed -> httpbin.org
```


Charles 抓包正常



![word/media/image21.png](https://gitee.com/cyrus-studio/images/raw/master/9ef92b782ecf6da6f59f3c68aefc0bcc.png)


App 中请求正常



![word/media/image22.png](https://gitee.com/cyrus-studio/images/raw/master/85c591c607396ef04b0e8a7f5ec80769.png)


# 完整源码



- Android 开源地址：[https://github.com/CYRUS-STUDIO/AndroidExample](https://github.com/CYRUS-STUDIO/AndroidExample)

- Frida 脚本开源地址：[https://github.com/CYRUS-STUDIO/frida-ssl-pinning-bypass](https://github.com/CYRUS-STUDIO/frida-ssl-pinning-bypass)



