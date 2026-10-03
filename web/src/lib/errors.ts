import { toast } from 'sonner'

type ErroBanco = { message?: string; code?: string }

// Constraints com mensagem padrão do Postgres em inglês: traduzidas aqui.
// As regras de negócio (triggers) já devolvem mensagens em português.
const CONSTRAINTS: Record<string, string> = {
  clientes_telefone_key: 'Já existe um cliente com esse telefone.',
  clientes_telefone_check: 'Telefone inválido: informe DDD + número (10 a 13 dígitos).',
  clientes_email_check: 'E-mail inválido.',
  clientes_nome_check: 'Informe o nome do cliente.',
  clientes_endereco_check: 'Informe o endereço da instalação.',
  produtos_nome_key: 'Já existe um produto com esse nome.',
  produtos_nome_check: 'Informe o nome do produto.',
  produtos_preco_unitario_check: 'O preço não pode ser negativo.',
  itens_pedido_quantidade_check: 'A quantidade deve ser maior que zero.',
}

export function mensagemErro(erro: unknown): string {
  if (!erro) return 'Erro desconhecido.'
  const { message, code } = erro as ErroBanco
  const texto = message ?? String(erro)

  for (const [constraint, traducao] of Object.entries(CONSTRAINTS)) {
    if (texto.includes(constraint)) return traducao
  }
  if (code === '42501') return 'Sem permissão para esta operação. Entre novamente no sistema.'
  if (texto.includes('Failed to fetch') || texto.includes('NetworkError')) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  if (texto.includes('JWT expired')) return 'Sua sessão expirou. Entre novamente.'
  return texto
}

export function toastErro(erro: unknown, titulo = 'Não foi possível concluir') {
  toast.error(titulo, { description: mensagemErro(erro) })
}
