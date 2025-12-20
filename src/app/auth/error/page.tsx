"use client";

import { Button, Container, rem, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "Configuration":
        return "ระบบมีปัญหาในการตั้งค่า กรุณาติดต่อผู้ดูแลระบบ";
      case "AccessDenied":
        return "คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ";
      case "Suspended":
        return "บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ";
      case "DatabaseError":
        return "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง";
      case "Verification":
        return "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่อีกครั้ง";
      case "OAuthSignin":
        return "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย LINE กรุณาลองใหม่";
      case "OAuthCallback":
        return "เกิดข้อผิดพลาดในการรับข้อมูลจาก LINE กรุณาลองใหม่";
      case "OAuthCreateAccount":
        return "ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ";
      case "EmailCreateAccount":
        return "ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่";
      case "Callback":
        return "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่";
      case "OAuthAccountNotLinked":
        return "อีเมลนี้ถูกใช้กับวิธีการเข้าสู่ระบบอื่นแล้ว กรุณาใช้วิธีการเดิม";
      case "EmailSignin":
        return "ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองใหม่";
      case "CredentialsSignin":
        return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      case "SessionRequired":
        return "กรุณาเข้าสู่ระบบก่อนเข้าถึงหน้านี้";
      default:
        return "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง";
    }
  };

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
      <Stack gap="lg" align="center">
        <Title
          order={1}
          style={{
            fontSize: rem(48),
          }}
        >
          ⚠️
        </Title>
        <Title order={2} ta="center">
          เกิดข้อผิดพลาด
        </Title>
        <Text size="md" c="dimmed" ta="center">
          {getErrorMessage(error)}
        </Text>
        {error && (
          <Text size="xs" c="dimmed" ta="center">
            รหัสข้อผิดพลาด: {error}
          </Text>
        )}
        <Stack gap="sm" w="100%" mt="md">
          <Link
            href="/signin"
            style={{ textDecoration: "none", width: "100%" }}
          >
            <Button fullWidth variant="primary">
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </Link>
          <Link href="/" style={{ textDecoration: "none", width: "100%" }}>
            <Button fullWidth variant="subtle">
              กลับไปหน้าหลัก
            </Button>
          </Link>
        </Stack>
      </Stack>
    </Container>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
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
          <Text ta="center">Loading...</Text>
        </Container>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
