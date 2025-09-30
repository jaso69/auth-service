// lib/deepseek.js - VERSIÓN MEJORADA
export class DeepSeekClient {
    static async searchDocuments(query, availableDocuments) {
        
        // Crear un resumen optimizado para la IA
        const documentsSummary = availableDocuments.map(doc => 
            `[${doc.id}] ${doc.brand} ${doc.model} - ${doc.type} (${doc.category}): ${doc.name}. Keywords: ${doc.keywords.join(', ')}. URL: ${doc.url}`
        ).join('\n');

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: "system",
                        content: `Eres un especialista en equipos audiovisuales. 
                        
                        DOCUMENTOS DISPONIBLES:
                        ${documentsSummary}
                        
                        INSTRUCCIONES:
                        1. Busca coincidencias EXACTAS primero (marca, modelo)
                        2. Luego busca coincidencias PARCIALES (categoría, tipo)
                        3. Finalmente sugerencias relacionadas
                        
                        RESPUESTA EN JSON:
                        {
                            "matches": [
                                {
                                    "documentId": 1,
                                    "name": "string",
                                    "type": "manual|specs|diagram",
                                    "url": "string", 
                                    "confidence": 0.0-1.0,
                                    "matchReason": "string explicando por qué coincide"
                                }
                            ],
                            "suggestions": [
                                {
                                    "query": "string para búsqueda alternativa",
                                    "reason": "string explicando la sugerencia"
                                }
                            ]
                        }`
                    },
                    {
                        role: "user",
                        content: `Usuario busca: "${query}"`
                    }
                ],
                temperature: 0.1, // Baja temperatura para respuestas consistentes
                max_tokens: 1500
            })
        });

        const data = await response.json();
        const aiResponse = JSON.parse(data.choices[0].message.content);
        
        // Enriquecer la respuesta con datos completos del documento
        return this.enrichWithDocumentData(aiResponse, availableDocuments);
    }

    static enrichWithDocumentData(aiResponse, availableDocuments) {
        // Reemplazar documentId con los datos completos del documento
        aiResponse.matches = aiResponse.matches.map(match => {
            const fullDoc = availableDocuments.find(doc => doc.id === match.documentId);
            return {
                ...fullDoc,
                confidence: match.confidence,
                matchReason: match.matchReason
            };
        });
        
        return aiResponse;
    }
}