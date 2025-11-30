"use client";

import { ProfileImage } from "@/@types/user";
import { supabase } from "@/client/supabase";
import { TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import { CalendarIcon } from "@/components/icons/CalendarIcon";
import { CameraIcon } from "@/components/icons/CameraIcon";
import { compressImage } from "@/lib/image-compression";
import { getUserProfile } from "@/services/profile/get";
import { saveProfileImages } from "@/services/profile/images";
import { updateUserProfile } from "@/services/profile/update";
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Image,
  LoadingOverlay,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  rem,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";

function EditProfilePage() {
  const { data } = useSession();
  const router = useRouter();

  // Profile states
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lineId, setLineId] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bio, setBio] = useState("");
  const [userStatus, setUserStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("ACTIVE");
  const [isVerified, setIsVerified] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile images states
  const [profileImages, setProfileImages] = useState<
    Array<ProfileImage & { tempId?: string }>
  >([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const profileImagesInputRef = useRef<HTMLInputElement | null>(null);

  const userId = data?.user?.id;
  const BUCKET = "dating";

  const openFilePicker = () => fileInputRef.current?.click();
  const openProfileImagesPicker = () =>
    profileImagesInputRef.current?.click();

  // Calculate age from birthday
  const calculateAge = (birthDate: Date | null): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Check username uniqueness
  const checkUsername = async (usernameToCheck: string) => {
    if (!usernameToCheck.trim() || !userId) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch("/api/users/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameToCheck, excludeUserId: userId }),
      });

      const data = await response.json();
      setUsernameAvailable(data.available);
      
      if (!data.available) {
        notifications.show({
          color: "red",
          title: "Username taken",
          message: "This username is already in use",
        });
      }
    } catch (error) {
      console.error("Error checking username:", error);
    } finally {
      setCheckingUsername(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      return;
    }

    (async () => {
      try {
        const profile = await getUserProfile(userId);
        setUsername(profile.username ?? "");
        setFullName(profile.fullName ?? "");
        setLastname(profile.lastname ?? "");
        setEmail(profile.email ?? "");
        setLineId(profile.lineId ?? "");
        setPhone(profile.phone ?? "");
        setGender(profile.gender ?? null);
        setBirthday(profile.birthday ? new Date(profile.birthday) : null);
        setAge(profile.age ?? calculateAge(profile.birthday ? new Date(profile.birthday) : null));
        setHeight(profile.height != null ? String(profile.height) : "");
        setWeight(profile.weight != null ? String(profile.weight) : "");
        setBio(profile.bio ?? "");
        setAvatarUrl(profile.avatarUrl ?? null);
        setProfileImages(profile.profileImages || []);
        setUserStatus(profile.userStatus ?? "ACTIVE");
        setIsVerified(profile.isVerified ?? false);
        setUpdatedAt(profile.updatedAt ?? null);
      } catch (err) {
        console.error(err);
        notifications.show({
          color: "red",
          title: "Load failed",
          message: (err as Error).message ?? "Could not load your profile.",
        });
      }
    })();
  }, [userId]);

  // Update age when birthday changes
  useEffect(() => {
    if (birthday) {
      const calculatedAge = calculateAge(birthday);
      setAge(calculatedAge);
    } else {
      setAge(null);
    }
  }, [birthday]);

  // Check username when it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username && username.trim() && userId) {
        checkUsername(username);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      notifications.show({
        color: "red",
        title: "Invalid file type",
        message: "Only PNG, JPG, or WEBP allowed.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({
        color: "red",
        title: "File too large",
        message: "Max 5MB.",
      });
      return;
    }

    setUploading(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file, 1920, 1920, 0.8);
      
      const ext = compressedFile.name.split(".").pop() || "jpg";
      const key = `users/${
        userId || "anon"
      }/avatar-${userId}-${new Date().toISOString()}.${ext}`;

      // Upload compressed file
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, compressedFile, {
          upsert: true,
          contentType: compressedFile.type,
          cacheControl: "3600",
        });

      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

      setAvatarUrl(pub.publicUrl);
      setAvatarKey(key);
    } catch (err) {
      console.error(err);
      notifications.show({
        color: "red",
        title: "Upload failed",
        message: (err as Error).message ?? "Upload failed",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProfileImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (profileImages.length + files.length > 5) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Maximum 5 images allowed",
      });
      return;
    }

    // Validate files
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    const invalidFiles = files.filter(
      (file) => !validTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (invalidFiles.length > 0) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Only PNG, JPG, or WEBP allowed. Max 5MB per file.",
      });
      return;
    }

    setUploadingImages(true);
    try {
      const newImages: Array<ProfileImage & { tempId?: string }> = [];

      for (const file of files) {
        // Compress image before upload
        const compressedFile = await compressImage(file, 1920, 1920, 0.8);
        
        const ext = compressedFile.name.split(".").pop() || "jpg";
        const key = `users/${userId || "anon"}/profile-images/${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

        // Upload compressed file
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(key, compressedFile, {
            upsert: false,
            contentType: compressedFile.type,
            cacheControl: "3600",
          });

        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

        newImages.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          imageKey: key,
          imageUrl: pub.publicUrl,
          order: profileImages.length + newImages.length,
          tempId: `temp-${Date.now()}-${Math.random()}`,
        });
      }

      setProfileImages([...profileImages, ...newImages]);
    } catch (err) {
      console.error(err);
      notifications.show({
        color: "red",
        title: "Upload failed",
        message: (err as Error).message ?? "Could not upload images",
      });
    } finally {
      setUploadingImages(false);
      if (profileImagesInputRef.current)
        profileImagesInputRef.current.value = "";
    }
  };

  const handleDeleteProfileImage = (index: number) => {
    const image = profileImages[index];
    setProfileImages(profileImages.filter((_, i) => i !== index));

    // If it's a temporary image (not saved yet), delete from storage
    if (image.tempId && userId) {
      supabase.storage
        .from(BUCKET)
        .remove([image.imageKey])
        .catch((err) => console.error("Error deleting temp image:", err));
    }
  };

  const handleSaveClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!data?.user.id) return;

    // Validate required fields
    if (!username.trim()) {
      setShowConfirmModal(false);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Username is required",
      });
      return;
    }

    if (usernameAvailable === false) {
      setShowConfirmModal(false);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Username is already taken. Please choose another.",
      });
      return;
    }

    if (!gender) {
      setShowConfirmModal(false);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Gender is required",
      });
      return;
    }

    if (!birthday) {
      setShowConfirmModal(false);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Date of birth is required",
      });
      return;
    }

    setShowConfirmModal(false);
    setSaving(true);

    try {
      const profileData = {
        username,
        name: fullName,
        lastname,
        gender,
        birthday,
        bio: bio || null,
        lineId: lineId || null,
        height: height || null,
        weight: weight || null,
        email: email || null,
        password: password || null,
      };

      await updateUserProfile(data.user.id, {
        ...profileData,
        profileImageKey: avatarKey,
      } as never);

      // Save profile images
      if (profileImages.length > 0) {
        await saveProfileImages(
          data.user.id,
          profileImages.map((img, index) => ({
            id: img.id,
            imageKey: img.imageKey,
            order: index,
          }))
        );
      }

      notifications.show({
        color: "green",
        title: "Success",
        message: "Profile saved successfully",
      });

      // Refresh profile data
      const updatedProfile = await getUserProfile(data.user.id);
      setUpdatedAt(updatedProfile.updatedAt ?? null);
    } catch (err) {
      console.error("Error saving profile:", err);
      notifications.show({
        color: "red",
        title: "Error",
        message: (err as Error).message ?? "Failed to save profile",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (status: "ACTIVE" | "INACTIVE" | "SUSPENDED") => {
    const labels = {
      ACTIVE: "การใช้งานปกติ",
      INACTIVE: "ไม่มีการใช้งาน",
      SUSPENDED: "พักการใช้งานชั่วคราว",
    };
    return labels[status];
  };

  const getVerificationStatusLabel = () => {
    if (isVerified) {
      return "ยืนยันตัวตนแล้ว";
    }
    return "รอยืนยันตัวตน";
  };

  return (
    <Box>
      {/* Header */}
      <Box
        pos="fixed"
        top={0}
        left={0}
        right={0}
        bg="#0F0F0F"
        style={{
          borderBottom: "1px solid var(--mantine-color-dark-4)",
          height: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX
          )} + env(safe-area-inset-top))`,
          paddingTop: "env(safe-area-inset-top)",
          zIndex: 100,
        }}
      >
        <Group h={rem(TOP_NAVBAR_HEIGHT_PX)} px="md" justify="space-between">
          <Text c="white" onClick={() => router.back()} style={{ cursor: "pointer" }}>
            ← Back
          </Text>
          <Text c="white" fw={600}>
            แก้ไขข้อมูลส่วนตัว
          </Text>
          <Text
            c="gold.5"
            fw={600}
            onClick={handleSaveClick}
            style={{ cursor: "pointer" }}
          >
            บันทึก
          </Text>
        </Group>
      </Box>

      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb="xl">
          {/* Profile Image */}
          <Box style={{ display: "grid", placeItems: "center" }}>
            <Box
              style={{
                position: "relative",
                width: rem(150),
                height: rem(150),
              }}
            >
              <LoadingOverlay
                visible={uploading}
                zIndex={2}
                overlayProps={{ radius: "lg", blur: 2 }}
              />
              <Box
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid var(--mantine-color-dark-4)",
                  background: avatarUrl
                    ? `center/cover no-repeat url(${avatarUrl})`
                    : "repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 20px 20px",
                  opacity: avatarUrl ? 1 : 0.8,
                  cursor: "pointer",
                }}
                onClick={openFilePicker}
                title="Change avatar"
              />

              <ThemeIcon
                radius="xl"
                size={34}
                style={{
                  position: "absolute",
                  right: rem(4),
                  bottom: rem(4),
                  backgroundColor: "white",
                  border: "1px solid var(--mantine-color-dark-4)",
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
                  zIndex: 3,
                  cursor: "pointer",
                }}
                variant="light"
                color="dark.4"
                onClick={openFilePicker}
                title="Upload"
              >
                <CameraIcon />
              </ThemeIcon>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </Box>
          </Box>

          {/* Status Display */}
          <Group gap="sm" justify="center">
            <Badge
              color={
                userStatus === "ACTIVE"
                  ? "green"
                  : userStatus === "SUSPENDED"
                  ? "red"
                  : "gray"
              }
              variant="light"
            >
              {getStatusLabel(userStatus)}
            </Badge>
            <Badge
              color={isVerified ? "blue" : "yellow"}
              variant="light"
            >
              {getVerificationStatusLabel()}
            </Badge>
          </Group>

          {/* Last Updated */}
          {updatedAt && (
            <Text c="dimmed" fz="xs" ta="center">
              แก้ไขล่าสุด: {format(new Date(updatedAt), "dd/MM/yyyy HH:mm")}
            </Text>
          )}

          {/* Required Fields Section */}
          <Stack gap="sm">
            <Text fw={700}>ข้อมูลส่วนตัว *</Text>
            
            {/* Full Name - Read Only */}
            <TextInput
              label="ชื่อ-นามสกุล"
              placeholder="ชื่อ-นามสกุล"
              value={`${fullName} ${lastname || ""}`.trim()}
              readOnly
              disabled
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-dark-7)",
                  cursor: "not-allowed",
                },
              }}
            />

            {/* Username - Editable */}
            <TextInput
              label="ชื่อผู้ใช้ *"
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              error={
                usernameAvailable === false
                  ? "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว"
                  : checkingUsername
                  ? "กำลังตรวจสอบ..."
                  : null
              }
              rightSection={
                usernameAvailable === true ? (
                  <Text c="green" fz="xs">✓</Text>
                ) : usernameAvailable === false ? (
                  <Text c="red" fz="xs">✗</Text>
                ) : null
              }
            />

            {/* Phone - Read Only */}
            <TextInput
              label="เบอร์ *"
              placeholder="เบอร์"
              value={phone}
              readOnly
              disabled
              styles={{
                input: {
                  backgroundColor: "var(--mantine-color-dark-7)",
                  cursor: "not-allowed",
                },
              }}
            />

            {/* Email - Editable */}
            <TextInput
              label="Email"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            {/* Password - Editable */}
            <PasswordInput
              label="Password"
              placeholder="Leave blank to keep current password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />

            {/* Line ID - Editable */}
            <TextInput
              label="Line ID"
              placeholder="Line ID"
              value={lineId}
              onChange={(e) => setLineId(e.currentTarget.value)}
            />

            {/* Gender - Dropdown */}
            <Select
              label="เพศ *"
              placeholder="เลือกเพศ"
              data={["Male", "Female", "Other"]}
              value={gender}
              onChange={setGender}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            {/* Date of Birth with Age Display */}
            <Box>
              <DateInput
                label="วันเกิด *"
                placeholder="เลือกวันเกิด"
                valueFormat="DD/MM/YYYY"
                variant="filled"
                value={birthday}
                onChange={(value) => setBirthday(value)}
                rightSection={<CalendarIcon />}
              />
              {age !== null && (
                <Text fz="xs" c="dimmed" mt="xs">
                  อายุ: {age} ปี
                </Text>
              )}
            </Box>

            {/* Height */}
            <TextInput
              label="ส่วนสูง"
              placeholder="ส่วนสูง"
              rightSection={<Text c="dimmed">cm</Text>}
              value={height}
              onChange={(e) => setHeight(e.currentTarget.value)}
            />

            {/* Weight */}
            <TextInput
              label="น้ำหนัก"
              placeholder="น้ำหนัก"
              rightSection={<Text c="dimmed">kg</Text>}
              value={weight}
              onChange={(e) => setWeight(e.currentTarget.value)}
            />

            {/* Bio - Long text with emoji support */}
            <Box>
              <Textarea
                label="Bio"
                placeholder="เขียนเกี่ยวกับตัวคุณ (รองรับ emoji)"
                autosize
                minRows={5}
                maxRows={10}
                value={bio}
                onChange={(e) => setBio(e.currentTarget.value)}
              />
            </Box>
          </Stack>

          {/* Profile Images Section */}
          <Stack gap="sm">
            <Text fw={700} c="red">
              เพิ่มรูปภาพ สูงสุด 5 ภาพ
            </Text>
            <SimpleGrid cols={3} spacing="sm">
              {profileImages.map((img, index) => (
                <Box
                  key={img.id || img.tempId}
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: rem(8),
                    overflow: "hidden",
                    border: "1px solid var(--mantine-color-dark-4)",
                  }}
                >
                  <Image
                    src={img.imageUrl}
                    alt={`Profile image ${index + 1}`}
                    fit="cover"
                    w="100%"
                    h="100%"
                  />
                  <Box
                    style={{
                      position: "absolute",
                      top: rem(4),
                      right: rem(4),
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      borderRadius: "50%",
                      width: rem(24),
                      height: rem(24),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => handleDeleteProfileImage(index)}
                  >
                    <Text c="white" fz="xs" fw={700}>
                      ×
                    </Text>
                  </Box>
                </Box>
              ))}
              {profileImages.length < 5 && (
                <Box
                  style={{
                    aspectRatio: "1",
                    borderRadius: rem(8),
                    border: "2px dashed var(--mantine-color-red-6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: "var(--mantine-color-dark-7)",
                  }}
                  onClick={openProfileImagesPicker}
                >
                  <Text c="red" fz="xl" fw={700}>
                    +
                  </Text>
                </Box>
              )}
            </SimpleGrid>
            <input
              ref={profileImagesInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleProfileImagesChange}
              style={{ display: "none" }}
            />
            {uploadingImages && (
              <Text c="dimmed" fz="xs" ta="center">
                Uploading images...
              </Text>
            )}
          </Stack>
        </Stack>
      </Container>

      {/* Confirmation Modal */}
      <Modal
        opened={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="ยืนยันการบันทึก"
        centered
      >
        <Stack gap="md">
          <Text>คุณต้องการบันทึกการเปลี่ยนแปลงหรือไม่?</Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setShowConfirmModal(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleConfirmSave} loading={saving}>
              บันทึก
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default EditProfilePage;
