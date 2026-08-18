// A aba de contratado usa nomes de veiculo diferentes da base consolidada de realizado.
// Este mapa converte o nome usado na aba de contratado para o(s) nome(s) equivalentes
// na base consolidada, permitindo cruzar contratado x entregue corretamente.
// "Meta" contratado cobre tanto Facebook quanto Instagram entregues.
export const CONTRATADO_PARA_REALIZADO = {
  Meta: ["Facebook", "Instagram"],
  "R7 Portal": ["Portal R7"],
  "Globo.com": ["globo.com"],
};

export function getVeiculosRealizadoEquivalentes(veiculoContratado) {
  return CONTRATADO_PARA_REALIZADO[veiculoContratado] || [veiculoContratado];
}
