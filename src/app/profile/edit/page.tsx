'use client';

import { ProfileImage } from '@/@types/user';
import { TOP_NAVBAR_HEIGHT_PX } from '@/components/element/TopNavbar';
import { CalendarIcon } from '@/components/icons/CalendarIcon';
import { CameraIcon } from '@/components/icons/CameraIcon';
import { notifyUserProfileUpdated } from '@/hooks/useUserProfile';
import { compressImage } from '@/lib/image-compression';
import { getUserProfile } from '@/services/profile/get';
import { saveProfileImages } from '@/services/profile/images';
import { updateUserProfile } from '@/services/profile/update';
import {
  deletePublicStorageFiles,
  uploadPublicStorageFile,
} from '@/services/supabase/storage';
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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function EditProfilePage() {
  const { data } = useSession();
  const router = useRouter();
  const { t } = useLocale();

  // Profile states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lineId, setLineId] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bio, setBio] = useState('');
  const [userStatus, setUserStatus] = useState<
    'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  >('ACTIVE');
  const [isVerified, setIsVerified] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<
    boolean | null
  >(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile images states
  const [profileImages, setProfileImages] = useState<
    Array<ProfileImage & { tempId?: string }>
  >([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const profileImagesInputRef = useRef<HTMLInputElement | null>(null);

  const userId = data?.user?.id;

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
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
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
      const response = await fetch('/api/users/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameToCheck,
          excludeUserId: userId,
        }),
      });

      const data = await response.json();
      setUsernameAvailable(data.available);

      if (!data.available) {
        notifications.show({
          color: 'red',
          title: t('usernameTaken'),
          message: t('usernameAlreadyUsed'),
        });
      }
    } catch (error) {
      console.error('Error checking username:', error);
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
        setUsername(profile.username ?? '');
        setEmail(profile.email ?? '');
        setLineId(profile.lineId ?? '');
        setPhone(profile.phone ?? '');
        setGender(profile.gender ?? null);
        setRelationshipStatus(profile.relationShipStatus ?? null);
        setBirthday(
          profile.birthday ? new Date(profile.birthday) : null,
        );
        setAge(
          profile.age ??
            calculateAge(
              profile.birthday ? new Date(profile.birthday) : null,
            ),
        );
        setHeight(
          profile.height != null ? String(profile.height) : '',
        );
        setWeight(
          profile.weight != null ? String(profile.weight) : '',
        );
        setBio(profile.bio ?? '');
        setAvatarUrl(profile.avatarUrl ?? null);
        setProfileImages(profile.profileImages || []);
        setUserStatus(profile.userStatus ?? 'ACTIVE');
        setIsVerified(profile.isVerified ?? false);
        setUpdatedAt(profile.updatedAt ?? null);
      } catch (err) {
        console.error(err);
        notifications.show({
          color: 'red',
          title: t('loadFailed'),
          message:
            (err as Error).message ?? t('failedToLoadProfile'),
        });
      }
    })();
  }, [userId, t]);

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

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      notifications.show({
        color: 'red',
        title: t('invalidFileType'),
        message: t('imageTypesAllowed'),
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({
        color: 'red',
        title: t('fileTooLarge'),
        message: t('maxFiveMb'),
      });
      return;
    }

    setUploading(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(
        file,
        1920,
        1920,
        0.8,
      );

      const ext = compressedFile.name.split('.').pop() || 'jpg';
      const key = `users/${
        userId || 'anon'
      }/avatar-${userId}-${new Date().toISOString()}.${ext}`;

      const publicUrl = await uploadPublicStorageFile(
        key,
        compressedFile,
        { upsert: true },
      );

      setAvatarUrl(publicUrl);
      setAvatarKey(key);
    } catch (err) {
      console.error(err);
      notifications.show({
        color: 'red',
        title: t('uploadFailed'),
        message: (err as Error).message ?? 'Upload failed',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (profileImages.length + files.length > 5) {
      notifications.show({
        color: 'red',
        title: t('error'),
        message: t('maxFiveImages'),
      });
      return;
    }

    // Validate files
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const invalidFiles = files.filter(
      (file) =>
        !validTypes.includes(file.type) ||
        file.size > 5 * 1024 * 1024,
    );

    if (invalidFiles.length > 0) {
      notifications.show({
        color: 'red',
        title: t('error'),
        message: t('imageTypesAndSize'),
      });
      return;
    }

    setUploadingImages(true);
    try {
      const newImages: Array<ProfileImage & { tempId?: string }> = [];

      for (const file of files) {
        // Compress image before upload
        const compressedFile = await compressImage(
          file,
          1920,
          1920,
          0.8,
        );

        const ext = compressedFile.name.split('.').pop() || 'jpg';
        const key = `users/${
          userId || 'anon'
        }/profile-images/${userId}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2)}.${ext}`;

        const publicUrl = await uploadPublicStorageFile(
          key,
          compressedFile,
        );

        newImages.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          imageKey: key,
          imageUrl: publicUrl,
          order: profileImages.length + newImages.length,
          tempId: `temp-${Date.now()}-${Math.random()}`,
        });
      }

      setProfileImages([...profileImages, ...newImages]);
    } catch (err) {
      console.error(err);
      notifications.show({
        color: 'red',
        title: t('uploadFailed'),
        message: (err as Error).message ?? 'Could not upload images',
      });
    } finally {
      setUploadingImages(false);
      if (profileImagesInputRef.current)
        profileImagesInputRef.current.value = '';
    }
  };

  const handleDeleteProfileImage = (index: number) => {
    const image = profileImages[index];
    setProfileImages(profileImages.filter((_, i) => i !== index));

    // If it's a temporary image (not saved yet), delete from storage
    if (image.tempId && userId) {
      deletePublicStorageFiles([image.imageKey]).catch((err) =>
        console.error('Error deleting temp image:', err),
      );
    }
  };

  const handleSaveClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!data?.user.id) return;

    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'ชื่อผู้ใช้จำเป็นต้องกรอก',
      });
      return;
    }

    if (UUID_LIKE_PATTERN.test(normalizedUsername)) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'กรุณาเปลี่ยนชื่อผู้ใช้ก่อนบันทึกโปรไฟล์',
      });
      return;
    }

    if (usernameAvailable === false) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น',
      });
      return;
    }

    if (!gender) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'เพศจำเป็นต้องเลือก',
      });
      return;
    }

    if (!birthday) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'วันเกิดจำเป็นต้องกรอก',
      });
      return;
    }

    if (!relationshipStatus) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'สถานะจำเป็นต้องเลือก',
      });
      return;
    }

    const heightValue = Number(height);
    const weightValue = Number(weight);
    if (
      !height.trim() ||
      !weight.trim() ||
      !Number.isFinite(heightValue) ||
      !Number.isFinite(weightValue) ||
      heightValue <= 0 ||
      weightValue <= 0
    ) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'กรุณากรอกน้ำหนักและส่วนสูง',
      });
      return;
    }

    if (!email.trim()) {
      setShowConfirmModal(false);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: 'อีเมลจำเป็นต้องกรอก',
      });
      return;
    }

    setShowConfirmModal(false);
    setSaving(true);

    try {
      const profileData = {
        username: normalizedUsername,
        gender,
        relationShipStatus: relationshipStatus,
        birthday,
        bio: bio || null,
        lineId: lineId || null,
        phone: phone || null,
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
          })),
        );
      }

      notifications.show({
        color: 'green',
        title: t('success'),
        message: t('profileSaved'),
      });

      notifyUserProfileUpdated();
      router.push('/profile');
    } catch (err) {
      console.error('Error saving profile:', err);
      notifications.show({
        color: 'red',
        title: t('error'),
        message: (err as Error).message ?? 'Failed to save profile',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ) => {
    const labels = {
      ACTIVE: 'การใช้งานปกติ',
      INACTIVE: 'ไม่มีการใช้งาน',
      SUSPENDED: 'พักการใช้งานชั่วคราว',
    };
    return labels[status];
  };

  const getVerificationStatusLabel = () => {
    if (isVerified) {
      return 'ยืนยันตัวตนแล้ว';
    }
    return 'รอยืนยันตัวตน';
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
          borderBottom: '1px solid var(--mantine-color-dark-4)',
          height: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX,
          )} + env(safe-area-inset-top))`,
          paddingTop: 'env(safe-area-inset-top)',
          zIndex: 100,
        }}
      >
        <Group
          h={rem(TOP_NAVBAR_HEIGHT_PX)}
          px="md"
          justify="space-between"
        >
          <Text
            c="white"
            onClick={() => router.back()}
            style={{ cursor: 'pointer' }}
          >
            ← Back
          </Text>
          <Text c="white" fw={600}>
            แก้ไขข้อมูลส่วนตัว
          </Text>
          <Text
            c="gold.5"
            fw={600}
            onClick={handleSaveClick}
            style={{ cursor: 'pointer' }}
          >
            บันทึก
          </Text>
        </Group>
      </Box>

      <Container
        size="xs"
        pt="md"
        px="md"
        mt={rem(TOP_NAVBAR_HEIGHT_PX)}
      >
        <Stack gap="lg" pb="xl">
          {/* Profile Image */}
          <Box style={{ display: 'grid', placeItems: 'center' }}>
            <Box
              style={{
                position: 'relative',
                width: rem(150),
                height: rem(150),
              }}
            >
              <LoadingOverlay
                visible={uploading}
                zIndex={2}
                overlayProps={{ radius: 'lg', blur: 2 }}
              />
              <Box
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '1px solid var(--mantine-color-dark-4)',
                  background: avatarUrl
                    ? `center/cover no-repeat url(${avatarUrl})`
                    : 'repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                  opacity: avatarUrl ? 1 : 0.8,
                  cursor: 'pointer',
                }}
                onClick={openFilePicker}
                title={t('changeAvatar')}
              />

              <ThemeIcon
                radius="xl"
                size={34}
                style={{
                  position: 'absolute',
                  right: rem(4),
                  bottom: rem(4),
                  backgroundColor: 'white',
                  border: '1px solid var(--mantine-color-dark-4)',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
                  zIndex: 3,
                  cursor: 'pointer',
                }}
                variant="light"
                color="dark.4"
                onClick={openFilePicker}
                title={t('upload')}
              >
                <CameraIcon />
              </ThemeIcon>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </Box>
          </Box>

          {/* Status Display */}
          <Group gap="sm" justify="center">
            <Badge
              color={
                userStatus === 'ACTIVE'
                  ? 'green'
                  : userStatus === 'SUSPENDED'
                    ? 'red'
                    : 'gray'
              }
              variant="light"
            >
              {getStatusLabel(userStatus)}
            </Badge>
            <Badge
              color={isVerified ? 'blue' : 'yellow'}
              variant="light"
            >
              {getVerificationStatusLabel()}
            </Badge>
          </Group>

          {/* Last Updated */}
          {updatedAt && (
            <Text c="dimmed" fz="xs" ta="center">
              แก้ไขล่าสุด:{' '}
              {format(new Date(updatedAt), 'dd/MM/yyyy HH:mm')}
            </Text>
          )}

          {/* Required Fields Section */}
          <Stack gap="sm">
            <Text fw={700}>ข้อมูลส่วนตัว *</Text>

            {/* Username - Editable */}
            <TextInput
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              label="ชื่อผู้ใช้ *"
              placeholder="ชื่อผู้ใช้"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              error={
                usernameAvailable === false
                  ? 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว'
                  : null
              }
              description={
                checkingUsername ? 'กำลังตรวจสอบ...' : undefined
              }
              rightSection={
                usernameAvailable === true ? (
                  <Text c="green" fz="xs">
                    ✓
                  </Text>
                ) : usernameAvailable === false ? (
                  <Text c="red" fz="xs">
                    ✗
                  </Text>
                ) : null
              }
            />

            {/* Phone - Editable */}
            <TextInput
              label="เบอร์"
              placeholder="เบอร์โทร"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />

            {/* Email - Editable */}
            <TextInput
              label={`${t('email')} *`}
              placeholder={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />

            {/* Password - Editable */}
            <PasswordInput
              label={t('password')}
              placeholder={t('passwordKeepCurrent')}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />

            {/* Line ID - Editable */}
            <TextInput
              label={t('lineId')}
              placeholder={t('lineId')}
              value={lineId}
              onChange={(e) => setLineId(e.currentTarget.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />

            {/* Gender - Dropdown */}
            <Select
              label="เพศ *"
              placeholder="เลือกเพศ"
              data={['ชาย', 'หญิง', 'อื่นๆ']}
              value={gender}
              onChange={setGender}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            {/* Relationship status - Dropdown */}
            <Select
              label="สถานะ *"
              placeholder="เลือกสถานะ"
              data={['ชาย', 'หญิง', 'คู่รัก']}
              value={relationshipStatus}
              onChange={setRelationshipStatus}
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
                onChange={(value) => {
                  if (value === null) {
                    setBirthday(null);
                  } else {
                    const dateValue =
                      typeof value === 'string'
                        ? new Date(value)
                        : value;
                    setBirthday(
                      dateValue instanceof Date ? dateValue : null,
                    );
                  }
                }}
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
              label="ส่วนสูง *"
              placeholder="ส่วนสูง (ซม.)"
              type="number"
              min={1}
              rightSection={<Text c="dimmed">cm</Text>}
              value={height}
              onChange={(e) => setHeight(e.currentTarget.value)}
            />

            {/* Weight */}
            <TextInput
              label="น้ำหนัก *"
              placeholder="น้ำหนัก (กก.)"
              type="number"
              min={1}
              rightSection={<Text c="dimmed">kg</Text>}
              value={weight}
              onChange={(e) => setWeight(e.currentTarget.value)}
            />

            {/* Bio - Long text with emoji support */}
            <Box>
              <Textarea
                label={t('intro')}
                placeholder={t('introPlaceholder')}
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
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: rem(8),
                    overflow: 'hidden',
                    border: '1px solid var(--mantine-color-dark-4)',
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
                      position: 'absolute',
                      top: rem(4),
                      right: rem(4),
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      borderRadius: '50%',
                      width: rem(24),
                      height: rem(24),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
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
                    aspectRatio: '1',
                    borderRadius: rem(8),
                    border: '2px dashed var(--mantine-color-red-6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--mantine-color-dark-7)',
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
              style={{ display: 'none' }}
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
