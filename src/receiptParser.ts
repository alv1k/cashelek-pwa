export interface ParsedItem {
  name: string
  price: string
  quantity: number
}

export function parseProverkachekaHTML(html: string): ParsedItem[] {
  const items: ParsedItem[] = []
  
  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Strategy 1: Look for the table with receipt items
  // proverkacheka usually uses a table or specific classes
  const rows = doc.querySelectorAll('tr')
  
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length >= 3) {
      // Common order: Name, Quantity, Price, Sum
      // Or: Name, Price, Quantity
      const name = cells[0].textContent?.trim() || ''
      const priceText = cells[cells.length - 2]?.textContent?.trim() || ''
      const qtyText = cells[cells.length - 3]?.textContent?.trim() || '1'
      
      const price = parseFloat(priceText.replace(',', '.'))
      const quantity = parseFloat(qtyText.replace(',', '.')) || 1
      
      if (name && !isNaN(price) && name !== 'Наименование' && name !== 'Товар') {
        items.push({ name, price: String(price), quantity })
      }
    }
  })

  // Strategy 2: If no table found, look for JSON in scripts (sometimes available)
  if (items.length === 0) {
    const scripts = doc.querySelectorAll('script')
    scripts.forEach(script => {
      const content = script.textContent || ''
      if (content.includes('"items"')) {
        try {
          const match = content.match(/\{.*"items":\s*\[.*\].*\}/s)
          if (match) {
            const data = JSON.parse(match[0])
            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                items.push({
                  name: item.name || '',
                  price: String((item.price || 0) / 100),
                  quantity: item.quantity || 1
                })
              })
            }
          }
        } catch (e) {
          console.error('Failed to parse JSON from script', e)
        }
      }
    })
  }

  // Strategy 3: Plain text regex fallback (if they just copied text)
  if (items.length === 0) {
    const lines = html.split('\n')
    lines.forEach(line => {
      // Pattern: "Product Name ... 123.45"
      const match = line.match(/(.+?)\s+(\d+[.,]\d{2})\s*$/)
      if (match) {
        items.push({
          name: match[1].trim(),
          price: match[2].replace(',', '.'),
          quantity: 1
        })
      }
    })
  }

  return items
}
