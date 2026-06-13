/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const email = $os.getenv("PB_LOCAL_ADMIN_EMAIL")
    const password = $os.getenv("PB_LOCAL_ADMIN_PASSWORD")

    if (!email || !password) {
        return
    }

    const admins = app.findCollectionByNameOrId("admin_users")
    const record = new Record(admins)

    record.set("email", email)
    record.set("password", password)
    record.set("passwordConfirm", password)

    app.save(record)
})
