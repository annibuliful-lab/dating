"use client";

import { supabase } from "@/client/supabase";
import { LineSignIn } from "@/components/social-button/LineSignIn";
import {
  Button,
  Container,
  Divider,
  Group,
  Image,
  PasswordInput,
  rem,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleClickSignIn = async () => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        notifications.show({
          title: "Login failed",
          message: "Invalid email or password",
          color: "red",
          autoClose: 5000,
        });
        return;
      }

      await router.push("/feed");
    } catch (err) {
      console.error("[signin-error]: ", err);
      notifications.show({
        title: "Login failed",
        message: "An error occurred. Please try again.",
        color: "red",
        autoClose: 5000,
      });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then((data) => {
      console.log("[supabase-session]", data);
    });
  }, []);

  return (
    <Container
      px="md"
      style={{
        display: "flex",
        flexDirection: "column",
        height: rem(812),
        maxWidth: rem(375),
        justifyContent: "center",
      }}
    >
      <Stack gap="md">
        <Image
          alt="logo"
          src="https://wcjxna7kg9rqnf7r.public.blob.vercel-storage.com/IMG_9165.PNG"
          fit="contain"
          w={rem(48)}
          h={rem(48)}
          style={{ display: "block" }}
        />

        <Text size="xl" fw={700}>
          Log in for Amorisloki
        </Text>
        <Text size="sm" c="dimmed">
          เข้าสู่ระบบด้วยช่องทางที่สมัครมาเท่านั้น
        </Text>

        <LineSignIn />

        <Group justify="center" gap="xs">
          <Divider w="40%" color="gray" />
          <Text size="xs" c="dimmed">
            or
          </Text>
          <Divider w="40%" color="gray" />
        </Group>

        <TextInput
          placeholder="Email"
          radius="md"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          styles={{
            input: {
              backgroundColor: "#131313",
              borderColor: "#333",
              color: "white",
              height: "50px",
            },
          }}
        />

        <PasswordInput
          placeholder="Password"
          radius="md"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          visible={showPassword}
          onVisibilityChange={setShowPassword}
          styles={{
            input: {
              backgroundColor: "#131313",
              borderColor: "#333",
              color: "white",
              height: "50px",
            },
          }}
        />

        <Button fullWidth variant="primary" onClick={handleClickSignIn}>
          Log in
        </Button>

        <Text size="sm" ta="center" mt="xs" fw={500}>
          <a href="#" style={{ color: "white", textDecoration: "none" }}>
            Forgot password
          </a>
        </Text>

        <Text size="sm" ta="center" c="dimmed">
          Don’t have an account?{" "}
          <Link href="/signup" style={{ color: "white", fontWeight: 500 }}>
            Create one
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}
