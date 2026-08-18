import { useAuth } from "../context/AuthContext.jsx";
import AgencyMatrixView from "../components/contentMatrix/AgencyView/AgencyMatrixView.jsx";
import VehicleMatrixView from "../components/contentMatrix/VehicleView/VehicleMatrixView.jsx";
import ClientMatrixView from "../components/contentMatrix/ClientView/ClientMatrixView.jsx";

export default function ContentMatrixPage({ campanhaId } = {}) {
  const { user } = useAuth();

  if (user.papel === "agencia") return <AgencyMatrixView campanhaId={campanhaId} />;
  if (user.papel === "veiculo") return <VehicleMatrixView campanhaId={campanhaId} />;
  return <ClientMatrixView campanhaId={campanhaId} />;
}
