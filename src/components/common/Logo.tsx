interface LogoProps {
  dark?: boolean
}
export default function Logo({ dark = false }: LogoProps) {
  return (
    <div className={`logo ${dark ? "logo-dark" : ""}`}>
      <img
        src={dark ? "/ufvjm-logo-white.png" : "/ufvjm-logo.png"}
        alt="Universidade Federal dos Vales do Jequitinhonha e Mucuri"
      />
    </div>
  )
}
