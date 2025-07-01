function findSymbolsInAllModules(symbolNames) {
    console.log(`\n🔍 正在查找符号列表: ${symbolNames.join(", ")} ...\n`);

    const modules = Process.enumerateModules();
    let anyFound = false;

    modules.forEach(module => {
        let foundInThisModule = false;

        console.log(`📦 模块: ${module.name}`);
        console.log(`    ➤ 路径: ${module.path}`);
        console.log(`    ➤ 地址: ${module.base}`);
        console.log(`    ➤ 大小:  0x${module.size.toString(16)} (${module.size} bytes)`);

        symbolNames.forEach(symbolName => {
            try {
                const addr = Module.findExportByName(module.name, symbolName);
                if (addr) {
                    console.log(`    ✅ 找到符号: ${symbolName}`);
                    console.log(`       ➤ 地址: ${addr}`);

                    const start = module.base;
                    const end = module.base.add(module.size);

                    if (addr.compare(start) >= 0 && addr.compare(end) < 0) {
                        const offset = addr.sub(start);
                        console.log(`       ➤ 模块偏移: 0x${offset.toString(16)} (${offset} bytes)`);
                    } else {
                        console.log(`       ⚠️ 地址不在模块内，偏移无效`);
                    }

                    foundInThisModule = true;
                    anyFound = true;
                }
            } catch (e) {
                console.log(`    ⚠️ 查找符号 ${symbolName} 时异常: ${e.message}`);
            }
        });

        if (!foundInThisModule) {
            console.log(`    ❌ 未找到目标符号\n`);
        } else {
            console.log(""); // 增加空行分隔
        }
    });

    if (!anyFound) {
        console.warn(`\n❌ 没有在任何模块中找到所需的符号`);
    }
}


setImmediate(function () {
    findSymbolsInAllModules([
        "SSL_CTX_set_cert_cb",
        "SSL_CTX_set_verify",
        "SSL_read",
        "SSL_write"
    ]);
});


// frida -H 127.0.0.1:1234 -F -l find_ssl_symbol_module.js
// frida -H 127.0.0.1:1234 -F -l find_ssl_symbol_module.js -o log.txt