export function CheckCircle() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 19.25V19.25C6.44325 19.25 2.75 15.5568 2.75 11V11C2.75 6.44325 6.44325 2.75 11 2.75V2.75C15.5568 2.75 19.25 6.44325 19.25 11V11C19.25 15.5568 15.5568 19.25 11 19.25Z"
        stroke="#4C4C4C"
        strokeWidth={1.375}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.6668 9.16675L10.0835 13.7501L7.3335 11.0001"
        stroke="#4C4C4C"
        strokeWidth={1.375}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActiveCheckCircle() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 19.25C6.44325 19.25 2.75 15.5568 2.75 11C2.75 6.44325 6.44325 2.75 11 2.75C15.5568 2.75 19.25 6.44325 19.25 11C19.25 15.5568 15.5568 19.25 11 19.25Z"
        fill="#079455"
        stroke="#079455"
        strokeWidth={1.375}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.6668 9.16675L10.0835 13.7501L7.3335 11.0001"
        stroke="white"
        strokeWidth={1.375}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
