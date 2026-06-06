import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 174 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        {/* Weak base fill for A, G, E, N, C, E */}
        <path d="M18 24H6V18H18V24ZM48 30H36V24H48V30ZM84 24V30H66V24H84ZM102 30H96V24H102V30ZM108 18H102V12H108V18ZM144 30H126V18H144V30ZM174 24V30H156V24H174Z" fill="var(--icon-weak-base)" />
        {/* Base fill for A, G, E */}
        <path d="M0 36V6H24V36H18V12H6V36H0ZM30 36V6H54V12H36V30H48V24H42V18H54V36H30ZM84 24H66V30H84V36H60V6H84V24ZM66 18H78V12H66V18Z" fill="var(--icon-base)" />
        {/* Strong base fill for N, C, E */}
        <path d="M90 36V6H96V12H102V18H108V6H114V36H108V30H102V24H96V36H90ZM144 12H126V30H144V36H120V6H144V12ZM174 24H156V30H174V36H150V6H174V24ZM156 18H168V12H156V18Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}

