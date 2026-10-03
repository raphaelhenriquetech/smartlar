// Consulta de CEP no ViaCEP (API pública, sem chave, libera CORS).
export type EnderecoCep = { rua: string; bairro: string; cidade: string; uf: string }

export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const controle = new AbortController()
  const limite = setTimeout(() => controle.abort(), 6000)
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controle.signal })
    if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`)
    const dados = await resposta.json()
    if (dados.erro) return null // CEP com formato válido, mas inexistente
    // O "complemento" do ViaCEP é a faixa de numeração do CEP, não o da casa: não usamos.
    return { rua: dados.logradouro ?? '', bairro: dados.bairro ?? '', cidade: dados.localidade ?? '', uf: dados.uf ?? '' }
  } finally {
    clearTimeout(limite)
  }
}
