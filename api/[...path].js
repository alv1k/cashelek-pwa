export default async function handler(req, res) {
  const { path: pathSegments } = req.query
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments
  
  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`)
  const target = `http://91.132.161.112:3080/api/${path}${url.search}`

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) 
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
    })

    const data = await response.text()
    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    res.send(data)
  } catch (err) {
    console.error('Proxy error:', err)
    res.status(502).json({ error: 'API proxy error', message: err.message })
  }
}
