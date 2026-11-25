import React from 'react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface VersionHistoryProps {
  currentVersion: string;
  previousVersions: Array<{
    version: string;
    date: string;
    notes: string;
  }>;
}

export function VersionHistory({ currentVersion, previousVersions }: VersionHistoryProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Versão atual: {currentVersion}</p>
        <Badge variant="secondary">{currentVersion}</Badge>
      </div>

      {previousVersions.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm">Histórico de versões</h3>
          <ul className="space-y-2 text-sm">
            {previousVersions.map((v) => (
              <li key={v.version} className="flex items-start">
                <span className="text-mono font-medium mr-2">{v.version} </span>
                <span>{v.date}</span>
                <span>{v.notes}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open('https://github.com/Progiago/FoundFootage/releases', '_blank')}
      >
        Ver todas as versões no GitHub
      </Button>
    </div>
  );
}