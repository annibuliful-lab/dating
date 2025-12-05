export function CheckCircle() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 15.75V15.75C5.27175 15.75 2.25 12.7283 2.25 9V9C2.25 5.27175 5.27175 2.25 9 2.25V2.25C12.7283 2.25 15.75 5.27175 15.75 9V9C15.75 12.7283 12.7283 15.75 9 15.75Z"
        fill="#079455"
        stroke="#079455"
        strokeWidth="1.125"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5L8.25 11.25L6 9"
        stroke="white"
        strokeWidth="1.125"
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
