import IkusiLogo from "@/assets/images/ikusi-logo.png";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src={IkusiLogo}
      alt="Ikusi Digital Platform – Finanzas"
      className={`h-10 w-auto object-contain ${className}`}
    />
  );
}
