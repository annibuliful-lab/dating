import { Button } from "@mantine/core";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { LineIcon } from "../icons/LineIcon";

type LineSignInProps = {
  callbackUrl?: string;
  label?: string;
};

export function LineSignIn({
  callbackUrl = "/feed",
  label = "Continue with Line",
}: LineSignInProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLineSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn("line", {
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error("LINE sign-in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      leftSection={<LineIcon />}
      variant="secondary"
      onClick={handleLineSignIn}
      loading={isLoading}
      disabled={isLoading}
    >
      {label}
    </Button>
  );
}
