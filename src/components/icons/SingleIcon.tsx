interface SingleIconProps {
  color?: string;
}

export const SingleIcon = ({ color = "#989898" }: SingleIconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 25 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx={7.49795}
      cy={5.25716}
      r={2.25094}
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.49708 16.0117V20.0133C5.49708 20.5656 5.94527 21.0137 6.4975 21.0137H8.49833C9.05056 21.0137 9.49875 20.5656 9.49875 20.0133V16.0117L10.5542 15.3084C10.8323 15.1233 10.9994 14.8102 10.9994 14.476V11.0096C10.9994 10.4573 10.5512 10.0092 9.99896 10.0092H4.99688C4.44465 10.0092 3.99646 10.4573 3.99646 11.0096V14.476C3.99646 14.8102 4.16353 15.1233 4.44165 15.3084L5.49708 16.0117Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.0753 5.23511C18.2994 4.98901 18.6876 4.71289 19.2778 4.71289C20.3102 4.71289 21.0035 5.62127 21.0035 6.46762C21.0035 8.23736 18.6536 9.59292 18.0753 9.59292C17.4961 9.59292 15.1471 8.23736 15.1471 6.46762C15.1471 5.62127 15.8404 4.71289 16.8728 4.71289C17.4631 4.71289 17.8502 4.98901 18.0753 5.23511Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
