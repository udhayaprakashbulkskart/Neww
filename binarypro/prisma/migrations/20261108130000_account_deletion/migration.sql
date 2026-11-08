-- Members can delete their own account. The row stays for financial record-keeping; personal data is removed.
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';
