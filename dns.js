Java.perform(function () {
    const InetAddress = Java.use("java.net.InetAddress");

    // Hook 系统 DNS 查询
    InetAddress.getAllByName.overload("java.lang.String").implementation = function (host) {
        var result = this.getAllByName(host);
        var addresses = [];
        for (var i = 0; i < result.length; i++) {
            addresses.push(result[i].getHostAddress());
        }
        console.log("[System DNS] Host:", host, "=>", addresses.join(", "));
        return result;
    };

    console.log("✅ Hooked java.net.InetAddress.getAllByName");

    try {
        // OkHttp 的 DNS 接口
        const DnsInterface = Java.use("okhttp3.Dns");
        const Arrays = Java.use("java.util.Arrays");

        DnsInterface.lookup.implementation = function (hostname) {
            console.log("[OkHttp Dns] Lookup called for:", hostname);
            var result = this.lookup(hostname);
            console.log("    => Result:", Arrays.toString(result.toArray()));
            return result;
        };

        console.log("✅ Hooked okhttp3.Dns.lookup");
    } catch (e) {
        console.warn("⚠️ OkHttp Dns not found:", e.message);
    }

    // 可选：如果 App 使用 okhttp3.DnsOverHttps，自定义实现
    try {
        const Doh = Java.use("okhttp3.DnsOverHttps");
        Doh.lookup.implementation = function (hostname) {
            console.log("[DoH] Resolving:", hostname);
            var ips = this.lookup(hostname);
            console.log("    =>", ips.toString());
            return ips;
        };

        console.log("✅ Hooked okhttp3.DnsOverHttps.lookup");
    } catch (e) {
        console.warn("⚠️ okhttp3.DnsOverHttps not found:", e.message);
    }
});


// frida -H 127.0.0.1:1234 -F -l dns.js
// frida -H 127.0.0.1:1234 -l dns.js -f com.ss.android.ugc.aweme