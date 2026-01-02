"use client";

import { LineIcon } from "@/components/icons/LineIcon";
import {
    Box,
    Button,
    Container,
    Image,
    Modal,
    rem,
    Stack,
    Text,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSkip = () => {
    // When user skips verification:
    // - They can still use the app (status remains ACTIVE)
    // - isVerified remains false (no verify mark will be shown)
    // - Verification status will remain as "รอยืนยันตัวตน" (waiting for verification)
    // - No changes are made to the user's verification status
    router.push("/feed");
  };

  const handleAddLineOA = () => {
    // Open modal to show QR code
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCompleteVerification = () => {
    // Close modal and redirect to feed
    setIsModalOpen(false);
    router.push("/feed");
  };

  return (
    <>
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
        <Stack gap="xl" align="center">
          <Box
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: rem(120),
              height: rem(120),
              borderRadius: "50%",
              backgroundColor: "#131313",
              border: "2px solid #FFD400",
            }}
          >
            <LineIcon />
          </Box>

          <Stack gap="md" align="center">
            <Text size="xl" fw={700} ta="center">
              เพิ่ม Line OA เพื่อยืนยันตัวตน
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              เพื่อความปลอดภัยและความน่าเชื่อถือ กรุณาเพิ่ม Line OA
              เพื่อยืนยันตัวตนของคุณ
            </Text>
          </Stack>

          <Stack gap="md" w="100%">
            <Button
              fullWidth
              variant="primary"
              leftSection={<LineIcon />}
              onClick={handleAddLineOA}
            >
              เพิ่ม Line OA
            </Button>

            <Button
              fullWidth
              variant="subtle"
              onClick={handleSkip}
              styles={{
                root: {
                  color: "white",
                },
              }}
            >
              ข้าม
            </Button>
          </Stack>

          <Text size="xs" c="dimmed" ta="center">
            หากข้าม คุณสามารถใช้งานได้ แต่จะไม่มีเครื่องหมาย verify
            และสถานะจะยังเป็นรอยืนยันตัวตน
          </Text>
        </Stack>
      </Container>

      {/* Modal for LINE OA QR Code */}
      <Modal
        opened={isModalOpen}
        onClose={handleCloseModal}
        title={
          <Text size="lg" fw={700}>
            สแกน QR Code เพื่อเพิ่ม LINE OA
          </Text>
        }
        centered
        size="md"
        styles={{
          content: {
            backgroundColor: "#1a1a1a",
          },
          header: {
            backgroundColor: "#1a1a1a",
            borderBottom: "1px solid #333",
          },
          title: {
            color: "white",
          },
          close: {
            color: "white",
            "&:hover": {
              backgroundColor: "#333",
            },
          },
        }}
      >
        <Stack gap="lg" align="center" py="md">
          <Box
            style={{
              backgroundColor: "white",
              padding: rem(16),
              borderRadius: rem(12),
            }}
          >
            <Image
              src="/line.png"
              alt="LINE OA QR Code"
              width={280}
              height={280}
              fit="contain"
            />
          </Box>

          <Stack gap="sm" align="center">
            <Text size="sm" ta="center" c="white">
              เปิดแอป LINE แล้วสแกน QR Code นี้
            </Text>
            <Text size="xs" ta="center" c="dimmed">
              หลังจากเพิ่มเพื่อนแล้ว กรุณากด &quot;เสร็จสิ้น&quot; ด้านล่าง
            </Text>
          </Stack>

          <Stack gap="sm" w="100%">
            <Button
              fullWidth
              variant="primary"
              onClick={handleCompleteVerification}
            >
              เสร็จสิ้น
            </Button>
            <Button
              fullWidth
              variant="subtle"
              onClick={handleCloseModal}
              styles={{
                root: {
                  color: "white",
                },
              }}
            >
              ปิด
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
