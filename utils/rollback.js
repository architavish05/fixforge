'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * rollback.js
 *
 * Before applying any fix, callers should invoke backupFile() to snapshot
 * the original. restoreBackup() restores the most recent backup for a file.
 */

/** Ensures the backup directory exists. */
function ensureBackupDir() {
  if (!fs.existsSync(config.paths.backups)) {
    fs.mkdirSync(config.paths.backups, { recursive: true });
  }
}

/**
 * Creates a timestamped backup of a source file before patching.
 *
 * @param {string} filePath  Absolute path to the file to back up
 * @returns {string}  Path of the created backup file
 */
function backupFile(filePath) {
  ensureBackupDir();
  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const timestamp = Date.now();
  const backupName = `${baseName}_${timestamp}${ext}`;
  const backupPath = path.join(config.paths.backups, backupName);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Restores the most recent backup for the given source file.
 *
 * @param {string} filePath  Absolute path of the original source file to restore
 * @returns {{ restored: boolean, backupUsed: string | null, message: string }}
 */
function restoreBackup(filePath) {
  ensureBackupDir();

  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);

  // Find all backups for this file, sorted newest first
  let backups;
  try {
    backups = fs.readdirSync(config.paths.backups)
      .filter(f => f.startsWith(baseName + '_') && f.endsWith(ext))
      .sort()
      .reverse();
  } catch {
    return { restored: false, backupUsed: null, message: 'Could not read backup directory.' };
  }

  if (backups.length === 0) {
    return { restored: false, backupUsed: null, message: `No backup found for ${path.basename(filePath)}.` };
  }

  const backupPath = path.join(config.paths.backups, backups[0]);
  try {
    fs.copyFileSync(backupPath, filePath);
    return { restored: true, backupUsed: backupPath, message: `Restored from ${backups[0]}.` };
  } catch (err) {
    return { restored: false, backupUsed: null, message: `Restore failed: ${err.message}` };
  }
}

module.exports = { backupFile, restoreBackup };
