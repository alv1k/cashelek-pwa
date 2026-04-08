export default async function handler(req, res) {
  const path = req.url.replace(/^\/?api/, '/api')
  const target = `http://91.132.161.112:3080${path}`

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.text()
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    res.send(data)
  } catch (err) {
    res.status(502).json({ error: 'API proxy error', message: err.message })
  }
}
