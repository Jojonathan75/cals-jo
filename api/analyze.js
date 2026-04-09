export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { image, mediaType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image
              }
            },
            {
              type: 'text',
              text: `Analyse cette image et identifie TOUS les aliments visibles. Pour chaque aliment, estime les informations nutritionnelles pour la portion visible dans l'image.

Si c'est un produit emballé/packaging, lis les informations nutritionnelles sur l'emballage. Si un code-barres est visible, mentionne-le.

Réponds UNIQUEMENT en JSON valide, sans backticks ni markdown, avec exactement ce format:
{"foods":[{"name":"Nom en français","icon":"emoji","cal":0,"protein":0,"carbs":0,"fat":0,"grams":0}]}

Règles:
- cal = calories totales pour la portion estimée (pas pour 100g)
- protein/carbs/fat en grammes pour la portion estimée
- grams = poids estimé de la portion en grammes
- icon = un seul emoji représentant l'aliment
- Si aucun aliment détecté, retourne {"foods":[]}
- Sois précis sur les portions visibles`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'API error' });
    }

    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Parse JSON from response
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Analyze error:', err);
    return res.status(500).json({ error: 'Failed to analyze image', detail: err.message });
  }
}
