BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public."PostLike"
  DROP CONSTRAINT "PostLike_postId_fkey",
  ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId")
    REFERENCES public."Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public."PostSave"
  DROP CONSTRAINT "PostSave_postId_fkey",
  ADD CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId")
    REFERENCES public."Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
