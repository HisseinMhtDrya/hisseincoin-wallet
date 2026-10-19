
import { useEffect, useState } from "react";
import "./App.css";

const CONTRACT = "0x53Ddd8b956180327374e698194c5005e9aa8a397";
const SEPOLIA = "0xaa36a7";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("—");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("");
  const [chainId, setChainId] = useState("");
  const [sending, setSending] = useState(false);

  const normalizedRecipient = recipient.trim().toLowerCase();

  // Protection contre l'envoi au contrat lui-même.
  const recipientIsContract =
    normalizedRecipient === CONTRACT.toLowerCase();

  // Protection contre l'envoi au compte connecté.
  const recipientIsOwnAccount =
    Boolean(account) &&
    Boolean(normalizedRecipient) &&
    normalizedRecipient === account.toLowerCase();

  // Protection contre l'adresse nulle.
  const recipientIsZeroAddress =
    normalizedRecipient === ZERO_ADDRESS;

  const recipientIsBlocked =
    recipientIsContract ||
    recipientIsOwnAccount ||
    recipientIsZeroAddress;

  // Lire le solde HSC sur le contrat actif.
  async function readBalance(address) {
    const data =
      "0x70a08231" +
      address.slice(2).toLowerCase().padStart(64, "0");

    const result = await window.ethereum.request({
      method: "eth_call",
      params: [{ to: CONTRACT, data }, "latest"],
    });

    const raw = BigInt(result);
    const whole = raw / 10n ** 18n;

    const fraction = (raw % 10n ** 18n)
      .toString()
      .padStart(18, "0")
      .slice(0, 4)
      .replace(/0+$/, "");

    const formattedWhole = whole.toLocaleString("fr-FR");

    setBalance(
      fraction
        ? `${formattedWhole},${fraction}`
        : formattedWhole
    );
  }

  // Actualiser le compte et le réseau au démarrage.
  useEffect(() => {
    const ethereum = window.ethereum;

    if (!ethereum) {
      setChainId("");
      return;
    }

    let active = true;

    async function syncWallet() {
      try {
        const [network, accounts] = await Promise.all([
          ethereum.request({ method: "eth_chainId" }),
          ethereum.request({ method: "eth_accounts" }),
        ]);

        if (!active) return;

        setChainId(network);

        if (!accounts || accounts.length === 0) {
          setAccount("");
          setBalance("—");
          return;
        }

        setAccount(accounts[0]);

        if (network === SEPOLIA) {
          await readBalance(accounts[0]);
        } else {
          setBalance("—");
        }
      } catch {
        if (active) {
          setBalance("—");
          setMessage("Impossible de lire le portefeuille MetaMask.");
        }
      }
    }

    function handleChainChanged(network) {
      if (!active) return;

      setChainId(network);
      setBalance("—");
      setMessage("");

      if (network === SEPOLIA) {
        syncWallet();
      }
    }

    function handleAccountsChanged(accounts) {
      if (!active) return;

      setMessage("");

      if (!accounts || accounts.length === 0) {
        setAccount("");
        setBalance("—");
        return;
      }

      setAccount(accounts[0]);
      setBalance("—");
      syncWallet();
    }

    syncWallet();

    ethereum.on?.("chainChanged", handleChainChanged);
    ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      active = false;
      ethereum.removeListener?.("chainChanged", handleChainChanged);
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  // Connexion MetaMask.
  async function connectWallet() {
    if (!window.ethereum) {
      setMessage("Installe MetaMask depuis https://metamask.io.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const network = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(network);

      if (!accounts || accounts.length === 0) {
        setMessage("Aucun compte MetaMask disponible.");
        return;
      }

      setAccount(accounts[0]);

      if (network !== SEPOLIA) {
        setBalance("—");
        setMessage("Sélectionne Sepolia pour consulter les HSC.");
        return;
      }

      await readBalance(accounts[0]);
      setMessage("Portefeuille connecté. Solde HSC actualisé.");
    } catch (error) {
      setMessage(
        "Connexion impossible : " +
          (error?.message || "erreur MetaMask.")
      );
    }
  }

  // Changer de réseau seulement si nécessaire.
  async function switchNetwork() {
    if (!window.ethereum) {
      setMessage("Installe MetaMask pour changer de réseau.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA }],
      });

      const network = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(network);

      if (network !== SEPOLIA) {
        setMessage("Sepolia n'a pas été sélectionné.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        await readBalance(accounts[0]);
      }

      setMessage("Sepolia sélectionné.");
    } catch (error) {
      if (error?.code === 4902) {
        setMessage(
          "Ajoute le réseau Sepolia dans MetaMask puis réessaie."
        );
      } else if (error?.code === 4001) {
        setMessage("Changement de réseau annulé.");
      } else {
        setMessage(
          error?.message || "Impossible de changer de réseau."
        );
      }
    }
  }

  // Attendre la confirmation de la transaction.
  async function waitForReceipt(txHash) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const receipt = await window.ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });

      if (receipt) return receipt;

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return null;
  }

  // Envoyer des jetons HSC.
  async function prepareTransfer() {
    if (sending) return;

    setMessage("");

    if (!window.ethereum || !account) {
      setMessage("Connecte d'abord MetaMask.");
      return;
    }

    try {
      const network = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(network);

      if (network !== SEPOLIA) {
        setMessage("Sélectionne Sepolia avant le transfert.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (!accounts || accounts.length === 0) {
        setAccount("");
        setBalance("—");
        setMessage("Connecte d'abord MetaMask.");
        return;
      }

      const currentAccount = accounts[0];

      // Le compte peut avoir changé depuis la dernière connexion.
      if (currentAccount.toLowerCase() !== account.toLowerCase()) {
        setAccount(currentAccount);
        await readBalance(currentAccount);
        setMessage(
          "Le compte MetaMask a changé. Vérifie le destinataire puis réessaie."
        );
        return;
      }

      const destination = recipient.trim();
      const normalizedDestination = destination.toLowerCase();

      if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
        setMessage("Adresse du destinataire invalide.");
        return;
      }

      if (normalizedDestination === CONTRACT.toLowerCase()) {
        setMessage(
          "Envoi bloqué : cette adresse appartient au contrat HisseinCoin."
        );
        return;
      }

      if (normalizedDestination === currentAccount.toLowerCase()) {
        setMessage(
          "Envoi bloqué : tu as saisi l'adresse de ton propre compte MetaMask."
        );
        return;
      }

      if (normalizedDestination === ZERO_ADDRESS) {
        setMessage(
          "Envoi bloqué : l'adresse nulle n'est pas un destinataire valide."
        );
        return;
      }

      // Vérifier le montant et sa précision.
      const value = amount.trim();

      if (!/^(?:\d+(?:\.\d{0,18})?|\.\d{1,18})$/.test(value)) {
        setMessage(
          "Montant invalide : utilise au maximum 18 chiffres après la virgule."
        );
        return;
      }

      const parts = value.split(".");
      const wholePart = parts[0] || "0";
      const decimalPart = parts[1] || "";

      const units =
        BigInt(wholePart) * 10n ** 18n +
        BigInt((decimalPart + "0".repeat(18)).slice(0, 18));

      if (units <= 0n) {
        setMessage("Saisis un montant supérieur à zéro.");
        return;
      }

      // Fonction ERC-20 transfer(address,uint256).
      const data =
        "0xa9059cbb" +
        normalizedDestination.slice(2).padStart(64, "0") +
        units.toString(16).padStart(64, "0");

      setSending(true);
      setMessage("Vérifie les informations et les frais dans MetaMask.");

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: currentAccount,
            to: CONTRACT,
            data,
          },
        ],
      });

      setMessage(
        "Transaction envoyée. En attente de confirmation sur Sepolia..."
      );

      const receipt = await waitForReceipt(txHash);

      if (!receipt) {
        setMessage(
          `Transaction soumise, mais confirmation non détectée. ` +
          `Vérifie son statut sur Etherscan : ${txHash}`
        );
        return;
      }

      if (receipt.status === "0x0") {
        setMessage(
          `La transaction a échoué sur la blockchain. Hachage : ${txHash}`
        );
        await readBalance(currentAccount);
        return;
      }

      await readBalance(currentAccount);

      setMessage(
        `Transfert confirmé sur Sepolia. Hachage : ${txHash}`
      );
    } catch (error) {
      setMessage(
        error?.code === 4001
          ? "Transaction annulée dans MetaMask."
          : "Transfert échoué : " +
              (error?.shortMessage || error?.message || "erreur inconnue")
      );
    } finally {
      setSending(false);
    }
  }

  const networkLabel =
    chainId === SEPOLIA
      ? account
        ? "Sepolia connecté"
        : "Sepolia actif"
      : chainId
        ? "Autre réseau"
        : "Réseau non détecté";

  const shortAccount = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  return (
    <main className="wallet">
      <header className="topbar">
        <div className="coin-logo">H</div>

        <div className="brand">
          <h1>HisseinCoin</h1>
          <p>Votre portefeuille numérique</p>
        </div>

        <span
          className={`network ${
            chainId === SEPOLIA ? "network-connected" : "network-warning"
          }`}
        >
          {networkLabel}
        </span>
      </header>

      <section className="balance-card">
        <p>Solde HSC</p>

        <h2>
          {balance} <span>HSC</span>
        </h2>

        <p className="hint">
          {account
            ? "Portefeuille connecté"
            : "Connectez votre portefeuille"}
        </p>

        <button
          className={`connect ${
            account && chainId === SEPOLIA ? "connect-success" : ""
          }`}
          onClick={connectWallet}
        >
          {account
            ? `✓ ${shortAccount}`
            : "Connecter MetaMask"}
        </button>
      </section>

      <section className="actions">
        <button onClick={() => setMode("send")}>↗ Envoyer</button>
        <button onClick={() => setMode("receive")}>↙ Recevoir</button>
      </section>

      {mode === "receive" && (
        <section className="panel">
          <h3>Recevoir des HSC</h3>

          {account ? (
            <>
              <p>Ton adresse de réception :</p>
              <code className="address">{account}</code>

              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(account)
                    .then(() => setMessage("Adresse copiée."))
                    .catch(() =>
                      setMessage(
                        "Copie impossible : sélectionne l'adresse manuellement."
                      )
                    );
                }}
              >
                Copier mon adresse
              </button>
            </>
          ) : (
            <p>Connecte MetaMask pour afficher ton adresse.</p>
          )}
        </section>
      )}

      {mode === "send" && (
        <section className="panel">
          <h3>Envoyer des HSC</h3>

          <label>Adresse du destinataire</label>

          <input
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              setMessage("");
            }}
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
          />

          {recipientIsOwnAccount && (
            <p className="warning">
              Attention : c'est ton propre compte MetaMask.
              Tu ne peux pas t'envoyer des HSC à toi-même.
              Saisis l'adresse d'un autre portefeuille.
            </p>
          )}

          {recipientIsContract && (
            <p className="warning">
              Attention : cette adresse appartient au contrat HisseinCoin.
              Les jetons envoyés à cette adresse risquent d'être bloqués.
            </p>
          )}

          {recipientIsZeroAddress && (
            <p className="warning">
              Cette adresse est l'adresse nulle. L'envoi est interdit.
            </p>
          )}

          <label>Montant en HSC</label>

          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            min="0"
            step="any"
            placeholder="Ex. 10"
          />

          <button
            onClick={prepareTransfer}
            disabled={recipientIsBlocked || sending}
          >
            {sending ? "Transaction en cours..." : "Envoyer les HSC"}
          </button>
        </section>
      )}

      {account && chainId !== SEPOLIA && (
        <button
          className="secondary"
          onClick={switchNetwork}
        >
          Changer pour Sepolia
        </button>
      )}

      {message && (
        <p className="message" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <footer>
        HisseinCoin · Projet universitaire Blockchain
        <p>Jeton HSC de test sur le réseau Sepolia.</p>
      </footer>
    </main>
  );
}
