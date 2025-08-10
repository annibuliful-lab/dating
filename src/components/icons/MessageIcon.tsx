interface MessageIconProps {
  color?: string;
}

export const MessageIcon = ({ color = "#989898" }: MessageIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.41132 21.818C10.1193 21.818 12.3153 19.622 12.3153 16.914C12.3153 14.206 10.1203 12.01 7.41132 12.01C4.70232 12.01 2.50732 14.206 2.50732 16.914"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.41637 21.8231C6.67837 21.8231 5.97937 21.6601 5.35137 21.3691L2.33337 22.0101L2.96437 18.9861C2.67137 18.3561 2.50737 17.6541 2.50737 16.9141"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.89037 12.0381C6.53237 11.2171 6.33337 10.3221 6.33337 9.38307C6.33337 5.36607 9.93137 2.14307 14.3334 2.14307C18.7354 2.14307 22.3334 5.36607 22.3334 9.38307C22.3334 11.7571 21.0714 13.8471 19.1344 15.1651C19.1354 15.9211 19.1334 16.9401 19.1334 18.0101L15.9944 16.4641C15.4574 16.5671 14.9024 16.6231 14.3334 16.6231C13.6264 16.6231 12.9404 16.5391 12.2864 16.3821"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
