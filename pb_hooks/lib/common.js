const jsSdkPluginFactory = (config, extra) => {
    const { global } = config
    const host = extra?.host ?? `http://localhost:8090`

    // Store PocketBase instance
    let pb = null

    // Add pb() to global API
    global.pb = () => {
        if (pb) return pb
        pb = new PocketBase(host)
        return pb
    }

    return {}
}
