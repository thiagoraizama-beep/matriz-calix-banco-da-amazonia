// Rotulo exibido para o papel do usuario em vez do valor cru salvo no banco --
// agencia/cliente mostram o nome da instituicao, veiculo/parceiro mostram o(s)
// nome(s) do veiculo cadastrado (ex: "Go On Ad Group").
export function papelLabel(user) {
  if (user.papel === "agencia") return "Cálix Propagandas";
  if (user.papel === "cliente") return "Banco da Amazônia";
  if (user.papel === "veiculo" || user.papel === "parceiro") {
    return user.veiculos?.length ? user.veiculos.join(", ") : "Veículo";
  }
  return user.papel;
}
