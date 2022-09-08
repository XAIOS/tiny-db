module.exports = class {
  _is_ready
  _ready_hub = []
  _event_hub = {}

  constructor(name) {
    this.name = name
    this._Contact()
  }

  _Contact() {
    let request = indexedDB.open(this.name, 1)

    request.onsuccess = () => {
      this._db = request.result
      this.Each(i => i.time && i.time < Date.now() && this.Del(i.name))

      this._is_ready = true
      this._CheckReady()
    }

    request.onerror = e => {
      this._is_ready = false
      this.$emit('error', e.currentTarget.error)
    }

    request.onupgradeneeded = e => {
      this._db = request.result
      this._db.objectStoreNames.contains('db') || this._db.createObjectStore('db', { keyPath: 'name' })
    }
  }

  _CheckReady() {
    if (this._is_ready)
      while (this._ready_hub.length)
        this._ready_hub.shift()()
  }

  _Catch(handle) {
    try {
      handle()
    } catch {
      this._is_ready = false

      this.Ready(() => {
        this.$emit('recontact')
        try {
          handle()
        } catch(e) {
          this.$emit('error', e)
        }
      })
      this._Contact()
    }
  }

  Ready(handle) {
    this._ready_hub.push(handle)
    this._CheckReady()
  }

  Set(name, data, time) {
    return new Promise((resolve, reject) => {
      this._Catch(() => {
        let db = this._db.transaction(['db'], 'readwrite').objectStore('db')
        let request = db.get(name)

        request.onsuccess = () => {
          request = db[request.result ? 'put' : 'add']({ name, time, data })
          request.onsuccess = resolve
          request.onerror = reject
        }
      })
    })
  }

  Get(name) {
    return new Promise((resolve, reject) => {
      this._Catch(() => {
        let request = this._db.transaction(['db']).objectStore('db').get(name)

        request.onsuccess = () => resolve(request.result?.data ?? undefined)
        request.onerror = reject
      })
    })
  }

  Del(name) {
    return new Promise((resolve, reject) => {
      this._Catch(() => {
        let request = this._db.transaction(['db'], 'readwrite').objectStore('db').delete(name)

        request.onsuccess = resolve
        request.onerror = reject
      })
    })
  }

  Each(handle) {
    this._Catch(() => {
      let db = this._db.transaction('db').objectStore('db')
      let request = db.openCursor()

      request.onsuccess = () => {
        if (!request.result) return
        handle(request.result.value)
        request.result.continue()
      }
    })
  }

  $on(name, handle) {
    this._event_hub[name] = this._event_hub[name] || []
    this._event_hub[name].push(handle)
  }

  $emit(name, ...params) {
    this._event_hub[name]?.forEach(handle => handle(...params))
  }
}
