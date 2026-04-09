export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const { image, mediaType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const prompt = `Analyse cette image et identifie TOUS les aliments visibles. Pour chaque aliment, estime les informations nutritionnelles pour la portion visible dans l'image.

Si c'est un produit emballé/packaging, lis les informations nutritionnelles sur l'emballage. Si un code-barres est visible, mentionne le produit.

Réponds UNIQUEMENT en JSON valide, sans backticks ni markdown ni texte autour, avec exactement ce format:
{"foods":[{"name":"Nom en français","icon":"emoji","cal":0,"protein":0,"carbs":0,"fat":0,"grams":0}]}

Règles:
- cal = calories totales pour la portion estimée (pas pour 100g)
- protein/carbs/fat en grammes pour la portion estimée
- grams = poids estimé de la portion en grammes
- icon = un seul emoji représentant l'aliment
- Si aucun aliment détecté, retourne {"foods":[]}`;

    const body = {
      contents: [{
        parts: [
          { inlineData: { mimeType: mediaType || 'image/jpeg', data: image } },
          { text: prompt }
        ]
      }]
    };

    // Try multiple models in order
    const models = [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-pro-vision'
    ];

    let lastError = '';

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.error) {
          lastError = data.error.message || 'API error';
          continue; // Try next model
        }

        const text = data.candidates?.[0]?.content?.parts
          ?.filter(p => p.text)
          ?.map(p => p.text)
          ?.join('') || '';

        if (!text) {
          lastError = 'No response from AI';
          continue;
        }

        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.status(200).json(parsed);

      } catch (e) {
        lastError = e.message;
        continue; // Try next model
      }
    }

    return res.status(500).json({ error: lastError || 'All models failed' });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze image', detail: err.message });
  }
}
